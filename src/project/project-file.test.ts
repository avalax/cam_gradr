import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installedDialogs } from '../test-support/file-dialogs';

import { fileDialogs, openProjectFile, saveProjectFile } from './project-file';
import type { FileDialogs } from './project-file';

const download = vi.hoisted(() => vi.fn());
vi.mock('../lut/download', () => ({ downloadFile: download }));

const globals = globalThis as unknown as Record<string, unknown>;

// A file in the system's file dialogs: it can be read and written.
function fakeHandle(name: string, text = '') {
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

function installDialogs(dialogs: Partial<FileDialogs>): void {
  Object.assign(globals, dialogs);
}

function abort(): DOMException {
  return new DOMException('The user aborted a request.', 'AbortError');
}

describe('project file', () => {
  beforeEach(() => {
    download.mockReset();
  });

  afterEach(() => {
    delete globals.showOpenFilePicker;
    delete globals.showSaveFilePicker;
  });

  it('uses the system dialogs only where the browser has both of them', () => {
    expect(fileDialogs()).toBeNull();
    installDialogs({ showOpenFilePicker: vi.fn() });
    expect(fileDialogs()).toBeNull();
    installDialogs({ showSaveFilePicker: vi.fn() });
    expect(fileDialogs()).not.toBeNull();
  });

  it('opens a file and remembers its name and handle', async () => {
    const { handle } = fakeHandle('mein-projekt.json', '{"x":1}');
    const showOpenFilePicker = vi.fn().mockResolvedValue([handle]);
    installDialogs({ showOpenFilePicker, showSaveFilePicker: vi.fn() });
    const picked = await openProjectFile(installedDialogs());
    expect(picked).toEqual({ file: { name: 'mein-projekt.json', handle }, text: '{"x":1}' });
    expect(showOpenFilePicker).toHaveBeenCalledWith(expect.objectContaining({ multiple: false }));
  });

  it('treats a cancelled open dialog as no choice, other errors as errors', async () => {
    const showOpenFilePicker = vi.fn().mockRejectedValueOnce(abort());
    installDialogs({ showOpenFilePicker, showSaveFilePicker: vi.fn() });
    const dialogs = installedDialogs();
    await expect(openProjectFile(dialogs)).resolves.toBeNull();
    showOpenFilePicker.mockRejectedValueOnce(new DOMException('No access', 'NotAllowedError'));
    await expect(openProjectFile(dialogs)).rejects.toThrow('No access');
  });

  it('downloads under the name of the last file without the dialogs', async () => {
    await expect(
      saveProjectFile('content', { name: 'mein-projekt.json' }, 'default.json'),
    ).resolves.toEqual({ name: 'mein-projekt.json' });
    expect(download).toHaveBeenLastCalledWith('mein-projekt.json', 'content', 'application/json');
    await saveProjectFile('content', null, 'default.json');
    expect(download).toHaveBeenLastCalledWith('default.json', 'content', 'application/json');
  });

  it('saves in the folder of the last file with its name preselected', async () => {
    const loaded = fakeHandle('mein-projekt.json');
    const chosen = fakeHandle('mein-projekt.json');
    const showSaveFilePicker = vi.fn().mockResolvedValue(chosen.handle);
    installDialogs({ showOpenFilePicker: vi.fn(), showSaveFilePicker });
    const saved = await saveProjectFile(
      'content',
      { name: 'mein-projekt.json', handle: loaded.handle },
      'default.json',
    );
    expect(showSaveFilePicker).toHaveBeenCalledWith(
      expect.objectContaining({ suggestedName: 'mein-projekt.json', startIn: loaded.handle }),
    );
    expect(chosen.written).toEqual(['content']);
    expect(saved).toEqual({ name: 'mein-projekt.json', handle: chosen.handle });
    expect(download).not.toHaveBeenCalled();
  });

  it('suggests the default name without a last file and leaves the folder to the browser', async () => {
    const showSaveFilePicker = vi.fn().mockResolvedValue(fakeHandle('default.json').handle);
    installDialogs({ showOpenFilePicker: vi.fn(), showSaveFilePicker });
    await saveProjectFile('content', null, 'default.json');
    const [options] = showSaveFilePicker.mock.calls[0] as [Record<string, unknown>];
    expect(options.suggestedName).toBe('default.json');
    expect(options).not.toHaveProperty('startIn');
  });

  it('treats a cancelled save dialog as nothing saved, other errors as errors', async () => {
    const showSaveFilePicker = vi.fn().mockRejectedValueOnce(abort());
    installDialogs({ showOpenFilePicker: vi.fn(), showSaveFilePicker });
    await expect(saveProjectFile('content', null, 'default.json')).resolves.toBeNull();
    showSaveFilePicker.mockRejectedValueOnce(new Error('Disk full'));
    await expect(saveProjectFile('content', null, 'default.json')).rejects.toThrow('Disk full');
  });
});
