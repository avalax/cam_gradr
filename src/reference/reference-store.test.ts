import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { i18n } from '../lang';
import { chosenFile } from '../test-support/chosen-file';
import { dummyReferenceCsv, dummyReferenceJson } from '../test-support/dummy-reference';
import { failingStorage } from '../test-support/failing-storage';
import type { NamedStorage } from '../storage/indexed-db';
import { emptyReferenceStorage } from '../test-support/empty-storage';

import { BUNDLED_NAME } from './bundled';
import { setReferenceStorage, useReferenceStore } from './reference-store';
import type { ReferenceSet } from './reference';

describe('useReferenceStore', () => {
  let storage: NamedStorage<ReferenceSet>;

  beforeEach(() => {
    setActivePinia(createPinia());
    storage = emptyReferenceStorage();
  });

  it('contains the bundled set after loading and preselects it', async () => {
    const store = useReferenceStore();
    await store.load();
    expect(store.sets.map((set) => set.name)).toEqual([BUNDLED_NAME]);
    expect(store.selected?.name).toBe(BUNDLED_NAME);
    expect(Object.keys(store.selected?.patches ?? {})).toHaveLength(48);
    await store.load();
    expect(store.sets).toHaveLength(1);
  });

  it('imports, selects and saves a set locally, and reports the saving', async () => {
    const store = useReferenceStore();
    expect(store.lastSaved).toBeNull();
    await store.importChosen(chosenFile('a.json', dummyReferenceJson('Satz A')));
    expect(store.error).toBeNull();
    expect(store.selected?.name).toBe('Satz A');
    expect(store.lastSaved).toBe('Satz A');
    const saved = await storage.list();
    expect(saved.map((set) => set.name)).toEqual(['Satz A']);
  });

  it('loads saved sets in addition to the bundled one and preselects it', async () => {
    const first = useReferenceStore();
    await first.importChosen(chosenFile('a.json', dummyReferenceJson('Satz A')));
    setActivePinia(createPinia());
    const again = useReferenceStore();
    await again.load();
    expect(again.selectedName).toBe(BUNDLED_NAME);
    expect(again.sets.map((set) => set.name)).toEqual([BUNDLED_NAME, 'Satz A']);
    await again.load();
    expect(again.sets).toHaveLength(2);
  });

  it('keeps an already made selection on load', async () => {
    const store = useReferenceStore();
    await store.importChosen(chosenFile('a.json', dummyReferenceJson('Satz A')));
    await store.importChosen(chosenFile('b.json', dummyReferenceJson('Satz B')));
    store.select('Satz A');
    await store.load();
    expect(store.selectedName).toBe('Satz A');
  });

  it('replaces a set of the same name', async () => {
    const store = useReferenceStore();
    await store.importChosen(chosenFile('a.json', dummyReferenceJson('Satz A')));
    await store.importChosen(chosenFile('a.csv', dummyReferenceCsv()));
    await store.importChosen(chosenFile('b.json', dummyReferenceJson('Satz A')));
    expect(store.sets.filter((set) => set.name === 'Satz A')).toHaveLength(1);
  });

  it('reports faulty files and keeps the previous sets', async () => {
    const store = useReferenceStore();
    await store.importChosen(chosenFile('a.json', dummyReferenceJson('Satz A')));
    await store.importChosen(chosenFile('kaputt.json', '{"format":"x"}'));
    expect(store.error).toContain('Unbekanntes Format');
    expect(store.sets).toHaveLength(1);
    await store.importChosen(chosenFile('kaputt.json', dummyReferenceJson('Satz B')));
    expect(store.error).toBeNull();
  });

  it('shows only the outcome of the last action', async () => {
    const store = useReferenceStore();
    await store.importChosen(chosenFile('a.json', dummyReferenceJson('Satz A')));
    await store.remove('Satz A');
    expect(store.lastRemoved).toBe('Satz A');
    await store.importChosen(chosenFile('b.json', dummyReferenceJson('Satz B')));
    expect([store.lastRemoved, store.lastSaved]).toEqual([null, 'Satz B']);
    await store.importChosen(chosenFile('kaputt.json', '{"format":"x"}'));
    expect(store.lastSaved).toBeNull();
    expect(store.error).not.toBeNull();
    store.choose('Satz B');
    expect(store.error).toBeNull();
    await store.importChosen(chosenFile('kaputt.json', '{"format":"x"}'));
    await store.remove('Satz B');
    expect(store.error).toBeNull();
  });

  it('translates warnings when the language changes and drops the error of the validation', async () => {
    setReferenceStorage(failingStorage());
    const store = useReferenceStore();
    await store.load();
    expect(store.warning).toBe('Gespeicherte Referenzen konnten nicht geladen werden.');
    i18n.global.locale.value = 'en';
    expect(store.warning).toBe('Saved references could not be loaded.');
    await store.importChosen(chosenFile('kaputt.json', '{"format":"x"}'));
    expect(store.error).not.toBeNull();
    i18n.global.locale.value = 'de';
    expect(store.error).toBeNull();
  });

  it('keeps imported sets when loading only finishes afterwards', async () => {
    const slowList = Promise.withResolvers<ReferenceSet[]>();
    setReferenceStorage({
      list: () => slowList.promise,
      save: () => Promise.resolve(),
      remove: () => Promise.resolve(),
    });
    const store = useReferenceStore();
    const loading = store.load();
    await store.importChosen(chosenFile('neu.json', dummyReferenceJson('Neu')));
    slowList.resolve([
      { name: 'Alt', patches: {} },
      { name: 'Neu', patches: {} },
    ]);
    await loading;
    expect(store.sets.map((set) => set.name)).toEqual([BUNDLED_NAME, 'Alt', 'Neu']);
    expect(Object.keys(store.sets.find((set) => set.name === 'Neu')?.patches ?? {})).toHaveLength(
      48,
    );
    expect(store.selectedName).toBe('Neu');
  });

  it('selects only existing sets', async () => {
    const store = useReferenceStore();
    await store.importChosen(chosenFile('a.json', dummyReferenceJson('Satz A')));
    store.select('gibt es nicht');
    expect(store.selectedName).toBe('Satz A');
    await store.importChosen(chosenFile('b.json', dummyReferenceJson('Satz B')));
    store.select('Satz A');
    expect(store.selected?.name).toBe('Satz A');
  });

  it('deletes sets and selects another one', async () => {
    const store = useReferenceStore();
    await store.importChosen(chosenFile('a.json', dummyReferenceJson('Satz A')));
    await store.importChosen(chosenFile('b.json', dummyReferenceJson('Satz B')));
    await store.remove('Satz B');
    expect(store.selectedName).toBe('Satz A');
    await store.remove('Satz A');
    expect(store.selectedName).toBeNull();
    await store.remove('Satz Z');
    expect(await storage.list()).toEqual([]);
  });

  it('continues with the bundled set and a warning when the storage fails', async () => {
    setReferenceStorage(failingStorage());
    const store = useReferenceStore();
    await store.load();
    expect(store.warning).toContain('geladen');
    expect(store.selected?.name).toBe(BUNDLED_NAME);
    await store.importChosen(chosenFile('a.json', dummyReferenceJson('Satz A')));
    expect(store.selected?.name).toBe('Satz A');
    expect(store.warning).toContain('nur für diese Sitzung');
    expect(store.lastSaved).toBeNull();
    await store.remove('Satz A');
    expect(store.warning).toContain('gelöscht');
    expect(store.lastRemoved).toBeNull();
  });

  it('uses the IndexedDB storage of the browser unless replaced', async () => {
    setReferenceStorage(null);
    const store = useReferenceStore();
    // The test environment has no IndexedDB: loading fails and is reported.
    await store.load();
    expect(store.warning).not.toBeNull();
  });

  describe('mitgelieferter Satz', () => {
    it('is replaced by a custom set of the same name', async () => {
      await storage.save({ name: BUNDLED_NAME, patches: { '1A': [50, 0, 0] } });
      const store = useReferenceStore();
      await store.load();
      expect(store.sets).toHaveLength(1);
      expect(Object.keys(store.selected?.patches ?? {})).toEqual(['1A']);
    });
  });
});
