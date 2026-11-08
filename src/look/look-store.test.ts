import { IDBFactory } from 'fake-indexeddb';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { usePreviewStore } from '../lut/preview-store';
import { createIndexedDbStorage } from '../storage/indexed-db';
import type { NamedStorage } from '../storage/indexed-db';
import { failingStorage } from '../test-support/failing-storage';
import { IDENTITY_CUBE, INVERT_CUBE, cubeFile as file } from '../test-support/look-cubes';

import { parseLookCube } from './look';
import type { LookLut } from './look';
import { setLookStorage, useLookStore } from './look-store';

function look(name: string): LookLut {
  return parseLookCube(`${name}.cube`, IDENTITY_CUBE);
}

describe('useLookStore', () => {
  let storage: NamedStorage<LookLut>;

  beforeEach(() => {
    setActivePinia(createPinia());
    storage = createIndexedDbStorage<LookLut>(new IDBFactory(), 'test', 'looks');
    setLookStorage(storage);
  });

  it('loads the saved looks sorted by name; looks imported meanwhile stay', async () => {
    await storage.save(look('B'));
    await storage.save(look('A'));
    const store = useLookStore();
    await store.importFiles([file('B.cube'), file('C.cube')]);
    await store.load();
    expect(store.looks.map((entry) => entry.name)).toEqual(['A', 'B', 'C']);
    expect(store.find('A')?.lut.size).toBe(2);
    expect(store.find(null)).toBeNull();
  });

  it('imports and saves several files and chooses the last one in the preview', async () => {
    const store = useLookStore();
    await store.importFiles([file('Warm.cube'), file('Cold.CUBE')]);
    expect(store.looks.map((entry) => entry.name)).toEqual(['Cold', 'Warm']);
    expect(usePreviewStore().look).toBe('Cold');
    expect(store.messages).toEqual([{ kind: 'imported', names: ['Warm', 'Cold'] }]);
    const stored = await storage.list();
    expect(stored.map((entry) => entry.name).toSorted((a, b) => a.localeCompare(b))).toEqual([
      'Cold',
      'Warm',
    ]);
  });

  it('replaces a look of the same name', async () => {
    const store = useLookStore();
    await store.importFiles([file('Warm.cube')]);
    await store.importFiles([file('Warm.cube')]);
    expect(store.looks).toHaveLength(1);
  });

  it('names rejected files with the reason and keeps the valid ones', async () => {
    const store = useLookStore();
    await store.importFiles([
      file('notes.txt'),
      file('broken.cube', 'LUT_1D_SIZE 2'),
      file('Ok.cube'),
    ]);
    expect(store.looks.map((entry) => entry.name)).toEqual(['Ok']);
    // The errors come first: the room under the bar shows two lines.
    expect(store.messages[0]).toMatchObject({ kind: 'rejected', file: 'notes.txt' });
    expect(store.messages[0]).toHaveProperty('reason', 'Nur .cube-Dateien sind möglich.');
    expect(store.messages[1]).toMatchObject({ kind: 'rejected', file: 'broken.cube' });
    expect(store.messages[2]).toEqual({ kind: 'imported', names: ['Ok'] });
  });

  it('chooses nothing when no file was valid', async () => {
    const store = useLookStore();
    await store.importFiles([file('notes.txt')]);
    expect(usePreviewStore().look).toBeNull();
    expect(store.messages).toHaveLength(1);
  });

  it('warns about conversions from camera log curves instead of naming them as imported', async () => {
    const store = useLookStore();
    await store.importFiles([file('SLOG 3 S CINETONE_REC709.cube'), file('Warm.cube')]);
    expect(store.looks.map((look) => look.name)).toEqual(['SLOG 3 S CINETONE_REC709', 'Warm']);
    expect(store.messages).toEqual([
      { kind: 'logConversion', name: 'SLOG 3 S CINETONE_REC709' },
      { kind: 'imported', names: ['Warm'] },
    ]);
    await store.importFiles([file('LogC to Rec709.cube')]);
    expect(store.messages).toEqual([{ kind: 'logConversion', name: 'LogC to Rec709' }]);
  });

  it('deletes a look and brings it back with undo, chosen as before', async () => {
    const store = useLookStore();
    const preview = usePreviewStore();
    await store.importFiles([file('Warm.cube'), file('Cold.cube')]);
    await store.remove('Cold');
    expect(store.looks.map((entry) => entry.name)).toEqual(['Warm']);
    expect(preview.look).toBeNull();
    expect(store.messages).toEqual([{ kind: 'removed', name: 'Cold' }]);
    const remaining = await storage.list();
    expect(remaining.map((entry) => entry.name)).toEqual(['Warm']);

    await store.undo();
    expect(store.looks.map((entry) => entry.name)).toEqual(['Cold', 'Warm']);
    expect(preview.look).toBe('Cold');
    expect(store.messages).toEqual([]);
    expect(await storage.list()).toHaveLength(2);
    // Nothing left to undo.
    await store.undo();
    expect(store.looks).toHaveLength(2);
  });

  it('keeps the chosen look when another one is deleted and brought back', async () => {
    const store = useLookStore();
    const preview = usePreviewStore();
    await store.importFiles([file('Warm.cube'), file('Cold.cube')]);
    await store.remove('Warm');
    expect(preview.look).toBe('Cold');
    preview.setLook(null);
    await store.undo();
    expect(preview.look).toBeNull();
    await store.remove('Unknown');
    expect(store.looks).toHaveLength(2);
  });

  it('forgets undo after a new import and clears messages on dismiss', async () => {
    const store = useLookStore();
    await store.importFiles([file('Warm.cube')]);
    await store.remove('Warm');
    await store.importFiles([file('Cold.cube')]);
    await store.undo();
    expect(store.looks.map((entry) => entry.name)).toEqual(['Cold']);
    store.dismiss();
    expect(store.messages).toEqual([]);
  });

  it('reports storage problems and keeps working for this session', async () => {
    setLookStorage(failingStorage());
    const store = useLookStore();
    await store.load();
    expect(store.messages).toEqual([{ kind: 'loadFailed' }]);
    await store.importFiles([file('Warm.cube')]);
    expect(store.looks).toHaveLength(1);
    expect(store.messages).toEqual([
      { kind: 'saveFailed', name: 'Warm' },
      { kind: 'imported', names: ['Warm'] },
    ]);
    await store.remove('Warm');
    expect(store.messages).toEqual([{ kind: 'removeFailed' }]);
    await store.undo();
    expect(store.messages).toEqual([{ kind: 'saveFailed', name: 'Warm' }]);
  });

  it('makes the look LUTs of a project the whole list, also in the browser storage', async () => {
    const store = useLookStore();
    await store.importFiles([file('Warm.cube'), file('Blue.cube')]);
    await store.remove('Blue');
    // The project's Warm replaces the browser's, Blue goes; no undo is left over.
    const warm = parseLookCube('Warm.cube', INVERT_CUBE);
    expect(await store.replaceAll([warm, look('Cold')])).toBe(0);
    expect(store.looks.map((entry) => entry.name)).toEqual(['Cold', 'Warm']);
    expect(store.find('Warm')).toBe(warm);
    expect(store.messages).toEqual([]);
    await store.undo();
    expect(store.find('Blue')).toBeNull();
    const stored = await storage.list();
    expect(stored.map((entry) => entry.name).toSorted((a, b) => a.localeCompare(b))).toEqual([
      'Cold',
      'Warm',
    ]);
    expect(stored.find((entry) => entry.name === 'Warm')?.lut.data).toEqual(warm.lut.data);

    // A project without look LUTs empties the list.
    expect(await store.replaceAll([])).toBe(2);
    expect(store.looks).toEqual([]);
    expect(await storage.list()).toEqual([]);
  });

  it('keeps the look LUTs of a project for the session when the browser cannot store them', async () => {
    const store = useLookStore();
    setLookStorage(failingStorage());
    await store.replaceAll([look('Cold')]);
    expect(store.looks.map((entry) => entry.name)).toEqual(['Cold']);
    expect(store.messages).toEqual([{ kind: 'storeFailed' }]);
  });

  it('uses the IndexedDB storage of the browser unless replaced', async () => {
    setLookStorage(null);
    const store = useLookStore();
    // The test environment has no IndexedDB: loading fails and is reported.
    await store.load();
    expect(store.messages).toEqual([{ kind: 'loadFailed' }]);
  });
});
