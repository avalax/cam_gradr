import { useLookStore } from '../look/look-store';
import type { ChosenFile } from '../ui/chosen-file';

import { chosenFile } from './chosen-file';
import { emptyLookStorage } from './empty-storage';

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

// A .cube file as the file selection hands it over; without a text of its own it changes nothing.
export function cubeFile(name: string, text = IDENTITY_CUBE): ChosenFile {
  return chosenFile(name, text);
}

// Imports the files into an empty browser storage; the last valid one becomes the chosen look.
export async function importLooks(...files: ChosenFile[]): Promise<void> {
  emptyLookStorage();
  await useLookStore().importFiles(files);
}

// Imports the inverting look "Invert", which becomes the chosen look.
export async function chooseInvert(): Promise<void> {
  await importLooks(cubeFile('Invert.cube', INVERT_CUBE));
}
