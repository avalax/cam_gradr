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

  it('ist zu Beginn leer', async () => {
    expect(await storage.list()).toEqual([]);
  });

  it('speichert und liest Sätze', async () => {
    await storage.save(first);
    await storage.save(second);
    const all = await storage.list();
    const names = all.map((set) => set.name);
    expect(names.toSorted((a, b) => a.localeCompare(b))).toEqual(['Satz A', 'Satz B']);
    expect(all.find((set) => set.name === 'Satz A')).toEqual(first);
  });

  it('überschreibt einen Satz gleichen Namens', async () => {
    await storage.save(first);
    await storage.save({ ...first, patches: { '1D': [10, 0, 0] } });
    const all = await storage.list();
    expect(all).toHaveLength(1);
    expect(all[0]?.patches['1D']).toEqual([10, 0, 0]);
  });

  it('löscht Sätze', async () => {
    await storage.save(first);
    await storage.save(second);
    await storage.remove('Satz A');
    const remaining = await storage.list();
    expect(remaining.map((set) => set.name)).toEqual(['Satz B']);
  });

  it('behält Daten über mehrere Zugriffe mit derselben Datenbank', async () => {
    await storage.save(first);
    const again = createIndexedDbStorage(factory, 'test-db');
    expect(await again.list()).toEqual([first]);
  });

  it('trennt verschiedene Datenbanknamen', async () => {
    await storage.save(first);
    const other = createIndexedDbStorage(factory, 'andere-db');
    expect(await other.list()).toEqual([]);
  });

  it('meldet Fehler beim Öffnen', async () => {
    const broken = {
      open: () => {
        throw new Error('gesperrt');
      },
    } as unknown as IDBFactory;
    await expect(createIndexedDbStorage(broken, 'x').list()).rejects.toThrow('gesperrt');
  });

  it('meldet Fehler der Anfrage', async () => {
    const failingRequest = new EventTarget() as unknown as IDBOpenDBRequest;
    Object.assign(failingRequest, { error: null });
    const failing = {
      open: () => {
        queueMicrotask(() => failingRequest.dispatchEvent(new Event('error')));
        return failingRequest;
      },
    } as unknown as IDBFactory;
    await expect(createIndexedDbStorage(failing, 'x').list()).rejects.toThrow('IndexedDB-Fehler');
  });

  it('meldet Fehler der Transaktion', async () => {
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
      'IndexedDB-Fehler',
    );
  });
});
