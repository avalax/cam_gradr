// Local storage of named entries (reference sets, look LUTs) in the user's browser only: one object
// store per kind in the app's IndexedDB database.
export interface NamedStorage<T extends { name: string }> {
  list: () => Promise<T[]>;
  save: (entry: T) => Promise<void>;
  remove: (name: string) => Promise<void>;
}

// Version 1 only had the reference sets; version 2 added the look LUTs. The upgrade creates the
// stores that are missing and leaves the existing ones with their entries untouched.
const STORES = ['references', 'looks'] as const;
const VERSION = 2;

type StoreName = (typeof STORES)[number];

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
    const db = request.result;
    for (const store of STORES) {
      if (!db.objectStoreNames.contains(store)) {
        db.createObjectStore(store, { keyPath: 'name' });
      }
    }
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

export function createIndexedDbStorage<T extends { name: string }>(
  factory: IDBFactory,
  databaseName: string,
  store: StoreName,
): NamedStorage<T> {
  return {
    async list(): Promise<T[]> {
      const db = await open(factory, databaseName);
      const request = db.transaction(store, 'readonly').objectStore(store).getAll();
      const all = (await wrap(request)) as T[];
      db.close();
      return all;
    },

    async save(entry: T): Promise<void> {
      const db = await open(factory, databaseName);
      const transaction = db.transaction(store, 'readwrite');
      transaction.objectStore(store).put(entry);
      await done(transaction);
      db.close();
    },

    async remove(name: string): Promise<void> {
      const db = await open(factory, databaseName);
      const transaction = db.transaction(store, 'readwrite');
      transaction.objectStore(store).delete(name);
      await done(transaction);
      db.close();
    },
  };
}
