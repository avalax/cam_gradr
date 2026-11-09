import { IDBFactory } from 'fake-indexeddb';

import type { LookLut } from '../look/look';
import { setLookStorage, useLookStore } from '../look/look-store';
import { createIndexedDbStorage } from '../storage/indexed-db';
import type { NamedStorage } from '../storage/indexed-db';

// Made-up look LUTs as 2³ .cube files (R fastest): one changes nothing, one inverts every channel.
export const IDENTITY_CUBE = `LUT_3D_SIZE 2
0 0 0
1 0 0
0 1 0
1 1 0
0 0 1
1 0 1
0 1 1
1 1 1`;
export const INVERT_CUBE = `LUT_3D_SIZE 2
1 1 1
0 1 1
1 0 1
0 0 1
1 1 0
0 1 0
1 0 0
0 0 0`;

// A .cube file as the file selection hands it over.
export function cubeFile(name: string, text = IDENTITY_CUBE) {
  return { name, text: () => Promise.resolve(text) };
}

// Gives the look LUTs an empty browser storage of their own, as a fresh browser has it.
export function emptyLookStorage(): NamedStorage<LookLut> {
  const storage = createIndexedDbStorage<LookLut>(new IDBFactory(), 'test', 'looks');
  setLookStorage(storage);
  return storage;
}

// Imports the files into an empty browser storage; the last valid one becomes the chosen look.
export async function importLooks(...files: ReturnType<typeof cubeFile>[]): Promise<void> {
  emptyLookStorage();
  await useLookStore().importFiles(files);
}

// Imports the inverting look "Invert", which becomes the chosen look.
export async function chooseInvert(): Promise<void> {
  await importLooks(cubeFile('Invert.cube', INVERT_CUBE));
}
