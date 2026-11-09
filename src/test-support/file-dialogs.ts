import { fileDialogs } from '../project/project-file';
import type { FileDialogs } from '../project/project-file';

// The fake system dialogs installed by the test (fails the test if they are missing).
export function installedDialogs(): FileDialogs {
  const dialogs = fileDialogs();
  if (dialogs === null) {
    throw new Error('The test did not install the file dialogs.');
  }
  return dialogs;
}

// A file in the system dialogs (Chrome, Edge): it can be read, and what is written to it is kept.
export function fakeHandle(name: string, text = '') {
  const written: string[] = [];
  const handle = {
    name,
    getFile: () => Promise.resolve({ name, text: () => Promise.resolve(text) }),
    createWritable: () =>
      Promise.resolve({
        write: (content: string) => {
          written.push(content);
          return Promise.resolve();
        },
        close: () => Promise.resolve(),
      }),
  } as unknown as FileSystemFileHandle;
  return { handle, written };
}
