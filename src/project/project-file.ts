import { downloadFile } from '../lut/download';

// The project file that was loaded or saved last. In browsers with the File System Access API
// (Chrome, Edge) also its handle: saving then opens in its folder with its name preselected. Other
// browsers (Firefox) only learn its name and download under it.
export interface ProjectFile {
  name: string;
  handle?: FileSystemFileHandle;
}

interface FileType {
  description: string;
  accept: Record<string, string[]>;
}

// The two system dialogs of the File System Access API (not part of the TypeScript DOM types).
// With `multiple: false` the open dialog returns exactly one file.
export interface FileDialogs {
  showOpenFilePicker: (options: {
    types: FileType[];
    multiple: false;
  }) => Promise<[FileSystemFileHandle]>;
  showSaveFilePicker: (options: {
    types: FileType[];
    suggestedName: string;
    startIn?: FileSystemFileHandle;
  }) => Promise<FileSystemFileHandle>;
}

const JSON_FILES: FileType[] = [
  { description: 'cam_gradr', accept: { 'application/json': ['.json'] } },
];

// The system dialogs, where the browser has both of them; otherwise null.
export function fileDialogs(): FileDialogs | null {
  const candidate = globalThis as unknown as Partial<FileDialogs>;
  return typeof candidate.showOpenFilePicker === 'function' &&
    typeof candidate.showSaveFilePicker === 'function'
    ? (candidate as FileDialogs)
    : null;
}

// What the user chose in a system dialog; null if the dialog was closed without a choice, which is
// no error. Only the dialog itself can be cancelled: an AbortError while reading or writing the file
// afterwards is an error like any other.
async function choice<T>(dialog: Promise<T>): Promise<T | null> {
  try {
    return await dialog;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return null;
    }
    throw error;
  }
}

// Lets the user choose a project file in the system dialog; null if the dialog was cancelled.
export async function openProjectFile(
  dialogs: FileDialogs,
): Promise<{ file: ProjectFile; text: string } | null> {
  const picked = await choice(dialogs.showOpenFilePicker({ types: JSON_FILES, multiple: false }));
  if (picked === null) {
    return null;
  }
  const [handle] = picked;
  const file = await handle.getFile();
  return { file: { name: file.name, handle }, text: await file.text() };
}

// Saves the content: in the system dialog, opened in the folder of the last file with its name
// preselected, or without the dialogs as a download under the last file's name. Returns the file
// that was written, null if the dialog was cancelled.
export async function saveProjectFile(
  content: string,
  last: ProjectFile | null,
  fallbackName: string,
): Promise<ProjectFile | null> {
  const name = last?.name ?? fallbackName;
  const dialogs = fileDialogs();
  if (dialogs === null) {
    downloadFile(name, content, 'application/json');
    return { name };
  }
  const handle = await choice(
    dialogs.showSaveFilePicker({
      types: JSON_FILES,
      suggestedName: name,
      ...(last?.handle !== undefined && { startIn: last.handle }),
    }),
  );
  if (handle === null) {
    return null;
  }
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
  return { name: handle.name, handle };
}
