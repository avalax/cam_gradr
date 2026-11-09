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
