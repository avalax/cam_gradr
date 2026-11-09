import { readProblem } from './file-problem';
import type { ReadProblem } from './file-problem';

// A file chosen in the file input, as the browser hands it over (a File fits): its name and a way
// to read it. The stores read it themselves, so that a file the browser cannot read is named as such.
export interface ChosenFile {
  name: string;
  text: () => Promise<string>;
}

// Why the browser did not hand over a file, in the words of the app. What it threw goes to the
// console, so that it is not lost.
export function readFailure(error: unknown): ReadProblem {
  console.warn(error);
  return readProblem(error);
}

// Reads a chosen file: its text, or why the browser did not hand it over.
export async function readChosen(
  file: ChosenFile,
): Promise<{ text: string } | { problem: ReadProblem }> {
  try {
    return { text: await file.text() };
  } catch (error) {
    return { problem: readFailure(error) };
  }
}
