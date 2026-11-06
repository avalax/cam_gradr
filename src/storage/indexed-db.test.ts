import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ReferenceSet } from '../reference/reference';

import { createIndexedDbStorage } from './indexed-db';
import type { NamedStorage } from './indexed-db';

const first: ReferenceSet = { name: 'Satz A', patches: { '1D': [90, 0, 0], '2D': [80, 0, 0] } };
const second: ReferenceSet = { name: 'Satz B', patches: { '1D': [91, 0, 0] } };

describe('createIndexedDbStorage', () => {
  let storage: NamedStorage<ReferenceSet>;
  let factory: IDBFactory;

  beforeEach(() => {
    factory = new IDBFactory();
    storage = createIndexedDbStorage<ReferenceSet>(factory, 'test-db', 'references');
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
    const again = createIndexedDbStorage<ReferenceSet>(factory, 'test-db', 'references');
    expect(await again.list()).toEqual([first]);
  });

  it('keeps different database names apart', async () => {
    await storage.save(first);
    const other = createIndexedDbStorage<ReferenceSet>(factory, 'andere-db', 'references');
    expect(await other.list()).toEqual([]);
  });

  it('reports errors on opening', async () => {
    const broken = {
      open: () => {
        throw new Error('gesperrt');
      },
    } as unknown as IDBFactory;
    await expect(
      createIndexedDbStorage<ReferenceSet>(broken, 'x', 'references').list(),
    ).rejects.toThrow('gesperrt');
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
    await expect(
      createIndexedDbStorage<ReferenceSet>(failing, 'x', 'references').list(),
    ).rejects.toThrow('IndexedDB error');
  });

  it('keeps the reference sets of version 1 when it adds the look LUTs', async () => {
    const old = factory.open('test-db', 1);
    old.addEventListener('upgradeneeded', () => {
      old.result.createObjectStore('references', { keyPath: 'name' }).put(first);
    });
    await new Promise((resolve) => {
      old.addEventListener('success', resolve);
    });
    old.result.close();

    expect(await storage.list()).toEqual([first]);
    const looks = createIndexedDbStorage<{ name: string }>(factory, 'test-db', 'looks');
    expect(await looks.list()).toEqual([]);
  });

  it('keeps reference sets and look LUTs in separate stores', async () => {
    const looks = createIndexedDbStorage<{ name: string; size: number }>(
      factory,
      'test-db',
      'looks',
    );
    await looks.save({ name: 'Satz A', size: 33 });
    await storage.save(first);
    expect(await looks.list()).toEqual([{ name: 'Satz A', size: 33 }]);
    expect(await storage.list()).toEqual([first]);
    await looks.remove('Satz A');
    expect(await storage.list()).toEqual([first]);
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
    await expect(
      createIndexedDbStorage<ReferenceSet>(failing, 'x', 'references').save(first),
    ).rejects.toThrow('IndexedDB error');
  });
});
