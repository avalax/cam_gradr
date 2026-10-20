import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ReferenceSet } from './reference';
import { createIndexedDbStorage } from './storage';
import type { ReferenceStorage } from './storage';

const first: ReferenceSet = { name: 'Satz A', patches: { '1D': [90, 0, 0], '2D': [80, 0, 0] } };
const second: ReferenceSet = { name: 'Satz B', patches: { '1D': [91, 0, 0] } };

describe('createIndexedDbStorage', () => {
  let storage: ReferenceStorage;
  let factory: IDBFactory;

  beforeEach(() => {
    factory = new IDBFactory();
    storage = createIndexedDbStorage(factory, 'test-db');
  });

  it('is empty at the start', async () => {
    expect(await storage.list()).toEqual([]);
  });

  it('saves and reads sets', async () => {
    await storage.save(first);
    await storage.save(second);
    const all = await storage.list();
    const names = all.map((set) => set.name);
    expect(names.toSorted((a, b) => a.localeCompare(b))).toEqual(['Satz A', 'Satz B']);
    expect(all.find((set) => set.name === 'Satz A')).toEqual(first);
  });

  it('overwrites a set of the same name', async () => {
    await storage.save(first);
    await storage.save({ ...first, patches: { '1D': [10, 0, 0] } });
    const all = await storage.list();
    expect(all).toHaveLength(1);
    expect(all[0]?.patches['1D']).toEqual([10, 0, 0]);
  });

  it('deletes sets', async () => {
    await storage.save(first);
    await storage.save(second);
    await storage.remove('Satz A');
    const remaining = await storage.list();
    expect(remaining.map((set) => set.name)).toEqual(['Satz B']);
  });

  it('keeps data across several accesses with the same database', async () => {
    await storage.save(first);
    const again = createIndexedDbStorage(factory, 'test-db');
    expect(await again.list()).toEqual([first]);
  });

  it('trennt verschiedene Datenbanknamen', async () => {
    await storage.save(first);
    const other = createIndexedDbStorage(factory, 'andere-db');
    expect(await other.list()).toEqual([]);
  });

  it('reports errors on opening', async () => {
    const broken = {
      open: () => {
        throw new Error('gesperrt');
      },
    } as unknown as IDBFactory;
    await expect(createIndexedDbStorage(broken, 'x').list()).rejects.toThrow('gesperrt');
  });

  it('reports request errors', async () => {
    const failingRequest = new EventTarget() as unknown as IDBOpenDBRequest;
    Object.assign(failingRequest, { error: null });
    const failing = {
      open: () => {
        queueMicrotask(() => failingRequest.dispatchEvent(new Event('error')));
        return failingRequest;
      },
    } as unknown as IDBFactory;
    await expect(createIndexedDbStorage(failing, 'x').list()).rejects.toThrow('IndexedDB error');
  });

  it('reports transaction errors', async () => {
    const transaction = new EventTarget() as unknown as IDBTransaction;
    Object.assign(transaction, {
      error: null,
      objectStore: () => ({ put: vi.fn() }),
    });
    const request = new EventTarget() as unknown as IDBOpenDBRequest;
    Object.assign(request, {
      result: {
        transaction: () => {
          queueMicrotask(() => transaction.dispatchEvent(new Event('error')));
          return transaction;
        },
        close: vi.fn(),
      },
    });
    const failing = {
      open: () => {
        queueMicrotask(() => request.dispatchEvent(new Event('success')));
        return request;
      },
    } as unknown as IDBFactory;
    await expect(createIndexedDbStorage(failing, 'x').save(first)).rejects.toThrow(
      'IndexedDB error',
    );
  });
});
