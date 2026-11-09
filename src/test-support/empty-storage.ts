import { IDBFactory } from 'fake-indexeddb';

import type { LookLut } from '../look/look';
import { setLookStorage } from '../look/look-store';
import type { ReferenceSet } from '../reference/reference';
import { setReferenceStorage } from '../reference/reference-store';
import { createIndexedDbStorage } from '../storage/indexed-db';
import type { NamedStorage } from '../storage/indexed-db';

// Gives a store an empty browser storage of its own, as a fresh browser has it.
function emptyStorage<T extends { name: string }>(
  store: Parameters<typeof createIndexedDbStorage>[2],
  install: (storage: NamedStorage<T>) => void,
): NamedStorage<T> {
  const storage = createIndexedDbStorage<T>(new IDBFactory(), 'test', store);
  install(storage);
  return storage;
}

export function emptyLookStorage(): NamedStorage<LookLut> {
  return emptyStorage('looks', setLookStorage);
}

export function emptyReferenceStorage(): NamedStorage<ReferenceSet> {
  return emptyStorage('references', setReferenceStorage);
}
