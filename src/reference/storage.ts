import type { ReferenceSet } from './reference';

// Local storage of the imported reference sets (only in the user's browser).
export interface ReferenceStorage {
  list: () => Promise<ReferenceSet[]>;
  save: (set: ReferenceSet) => Promise<void>;
  remove: (name: string) => Promise<void>;
}

const STORE = 'references';
const VERSION = 1;

function wrap<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => {
      resolve(request.result);
    });
    request.addEventListener('error', () => {
      reject(request.error ?? new Error('IndexedDB error'));
    });
  });
}

function open(factory: IDBFactory, name: string): Promise<IDBDatabase> {
  const request = factory.open(name, VERSION);
  request.addEventListener('upgradeneeded', () => {
    request.result.createObjectStore(STORE, { keyPath: 'name' });
  });
  return wrap(request);
}

function done(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener('complete', () => {
      resolve();
    });
    transaction.addEventListener('error', () => {
      reject(transaction.error ?? new Error('IndexedDB error'));
    });
  });
}

export function createIndexedDbStorage(
  factory: IDBFactory,
  databaseName: string,
): ReferenceStorage {
  return {
    async list(): Promise<ReferenceSet[]> {
      const db = await open(factory, databaseName);
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      const all = (await wrap(request)) as ReferenceSet[];
      db.close();
      return all;
    },

    async save(set: ReferenceSet): Promise<void> {
      const db = await open(factory, databaseName);
      const transaction = db.transaction(STORE, 'readwrite');
      transaction.objectStore(STORE).put(set);
      await done(transaction);
      db.close();
    },

    async remove(name: string): Promise<void> {
      const db = await open(factory, databaseName);
      const transaction = db.transaction(STORE, 'readwrite');
      transaction.objectStore(STORE).delete(name);
      await done(transaction);
      db.close();
    },
  };
}
