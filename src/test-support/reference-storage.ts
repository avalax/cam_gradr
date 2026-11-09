import { IDBFactory } from 'fake-indexeddb';

import type { ReferenceSet } from '../reference/reference';
import { setReferenceStorage } from '../reference/reference-store';
import { createIndexedDbStorage } from '../storage/indexed-db';
import type { NamedStorage } from '../storage/indexed-db';

// Gives the reference sets an empty browser storage of their own, as a fresh browser has it.
export function emptyReferenceStorage(): NamedStorage<ReferenceSet> {
  const storage = createIndexedDbStorage<ReferenceSet>(new IDBFactory(), 'test', 'references');
  setReferenceStorage(storage);
  return storage;
}
