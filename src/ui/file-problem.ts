// Why the browser could not read or write a file: the key of its sentence in the language files
// (file), translated when shown, so that it follows a language switch. Only writing can run out of
// space or lose a file to write to; only reading can fail on the file itself.
export type ReadProblem = 'accessDenied' | 'fileInUse' | 'unreadable';
export type WriteProblem = 'accessDenied' | 'fileInUse' | 'noSpace' | 'unreachable';

// What the errors the browser throws mean for a file, told by their names alone: the message of an
// error is the browser's own English text, which fits into no sentence of the app.
const ACCESS_PROBLEMS = new Map<string, ReadProblem & WriteProblem>([
  ['NotAllowedError', 'accessDenied'],
  ['SecurityError', 'accessDenied'],
  ['NoModificationAllowedError', 'fileInUse'],
  ['InvalidStateError', 'fileInUse'],
]);
// A file or folder that went away since it was chosen can no longer be reached for writing.
const WRITE_PROBLEMS = new Map<string, WriteProblem>([
  ...ACCESS_PROBLEMS,
  ['QuotaExceededError', 'noSpace'],
  ['NotReadableError', 'unreachable'],
  ['NotFoundError', 'unreachable'],
]);

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : '';
}

// Why the browser did not hand over the text of a file. Apart from a refused access and a file in
// use, whatever it throws means that the file cannot be read (it went away or changed since it was
// chosen).
export function readProblem(error: unknown): ReadProblem {
  return ACCESS_PROBLEMS.get(errorName(error)) ?? 'unreadable';
}

// Why the browser could not write a file; null where its error names nothing the user could act on.
export function writeProblem(error: unknown): WriteProblem | null {
  return WRITE_PROBLEMS.get(errorName(error)) ?? null;
}
