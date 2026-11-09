import { fileDialogs } from '../project/project-file';
import type { FileDialogs } from '../project/project-file';

import { chosenFile } from './chosen-file';

// The fake system dialogs installed by the test (fails the test if they are missing).
export function installedDialogs(): FileDialogs {
  const dialogs = fileDialogs();
  if (dialogs === null) {
    throw new Error('The test did not install the file dialogs.');
  }
  return dialogs;
}

// A file in the system dialogs (Chrome, Edge): reading it gives its text, or fails with the error
// the browser throws for it, and what is written to it is kept, unless writing fails with
// `writeError`.
export function fakeHandle(
  name: string,
  text: string | DOMException = '',
  writeError: DOMException | null = null,
) {
  const written: string[] = [];
  const handle = {
    name,
    getFile: () => Promise.resolve(chosenFile(name, text)),
    createWritable: () =>
      Promise.resolve({
        write: (content: string) => {
          if (writeError !== null) {
            return Promise.reject(writeError);
          }
          written.push(content);
          return Promise.resolve();
        },
        close: () => Promise.resolve(),
      }),
  } as unknown as FileSystemFileHandle;
  return { handle, written };
}
