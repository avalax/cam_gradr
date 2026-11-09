import type { ChosenFile } from '../ui/chosen-file';

// What the browser throws when reading a file that went away or became unreadable after it was
// chosen.
export function notReadable(): DOMException {
  return new DOMException('The requested file could not be read.', 'NotReadableError');
}

// A file as the file input hands it over: reading it gives its text, or fails with the error the
// browser throws for it.
export function chosenFile(name: string, text: string | DOMException): ChosenFile {
  return {
    name,
    text: () => (typeof text === 'string' ? Promise.resolve(text) : Promise.reject(text)),
  };
}
