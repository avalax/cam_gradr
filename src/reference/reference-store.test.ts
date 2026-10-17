import { IDBFactory } from 'fake-indexeddb';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { dummyReferenceCsv, dummyReferenceJson } from '../test-support/dummy-reference';

import { BUNDLED_NAME } from './bundled';
import { setReferenceStorage, useReferenceStore } from './reference-store';
import type { ReferenceSet } from './reference';
import { createIndexedDbStorage } from './storage';
import type { ReferenceStorage } from './storage';

const download = vi.hoisted(() => vi.fn());
vi.mock('../lut/download', () => ({ downloadFile: download }));

function failingStorage(): ReferenceStorage {
  const fail = () => Promise.reject(new Error('kaputt'));
  return { list: fail, save: fail, remove: fail };
}

describe('useReferenceStore', () => {
  let storage: ReferenceStorage;

  beforeEach(() => {
    setActivePinia(createPinia());
    storage = createIndexedDbStorage(new IDBFactory(), 'test');
    setReferenceStorage(storage);
  });

  it('enthält nach dem Laden den mitgelieferten Satz und wählt ihn vor', async () => {
    const store = useReferenceStore();
    await store.load();
    expect(store.sets.map((set) => set.name)).toEqual([BUNDLED_NAME]);
    expect(store.selected?.name).toBe(BUNDLED_NAME);
    expect(Object.keys(store.selected?.patches ?? {})).toHaveLength(48);
    await store.load();
    expect(store.sets).toHaveLength(1);
  });

  it('importiert, wählt und speichert einen Satz lokal', async () => {
    const store = useReferenceStore();
    await store.importFile('a.json', dummyReferenceJson('Satz A'));
    expect(store.error).toBeNull();
    expect(store.selected?.name).toBe('Satz A');
    const saved = await storage.list();
    expect(saved.map((set) => set.name)).toEqual(['Satz A']);
  });

  it('meldet, sobald ein Satz lokal gespeichert ist', async () => {
    const store = useReferenceStore();
    expect(store.lastSaved).toBeNull();
    await store.importFile('a.json', dummyReferenceJson('Satz A'));
    expect(store.lastSaved).toBe('Satz A');
  });

  it('meldet kein Speichern, wenn der Speicher ausfällt', async () => {
    setReferenceStorage(failingStorage());
    const store = useReferenceStore();
    await store.importFile('a.json', dummyReferenceJson('Satz A'));
    expect(store.lastSaved).toBeNull();
  });

  it('meldet, sobald ein Satz lokal gelöscht ist', async () => {
    const store = useReferenceStore();
    await store.importFile('a.json', dummyReferenceJson('Satz A'));
    expect(store.lastRemoved).toBeNull();
    await store.remove('Satz A');
    expect(store.lastRemoved).toBe('Satz A');
  });

  it('meldet kein Löschen, wenn der Speicher ausfällt', async () => {
    setReferenceStorage(failingStorage());
    const store = useReferenceStore();
    await store.remove('Satz A');
    expect(store.lastRemoved).toBeNull();
  });

  it('lädt gespeicherte Sätze zusätzlich zum mitgelieferten und wählt diesen vor', async () => {
    const first = useReferenceStore();
    await first.importFile('a.json', dummyReferenceJson('Satz A'));
    setActivePinia(createPinia());
    const again = useReferenceStore();
    await again.load();
    expect(again.selectedName).toBe(BUNDLED_NAME);
    expect(again.sets.map((set) => set.name)).toEqual([BUNDLED_NAME, 'Satz A']);
    await again.load();
    expect(again.sets).toHaveLength(2);
  });

  it('behält eine bereits getroffene Auswahl beim Laden', async () => {
    const store = useReferenceStore();
    await store.importFile('a.json', dummyReferenceJson('Satz A'));
    await store.importFile('b.json', dummyReferenceJson('Satz B'));
    store.select('Satz A');
    await store.load();
    expect(store.selectedName).toBe('Satz A');
  });

  it('ersetzt einen Satz gleichen Namens', async () => {
    const store = useReferenceStore();
    await store.importFile('a.json', dummyReferenceJson('Satz A'));
    await store.importFile('a.csv', dummyReferenceCsv());
    await store.importFile('b.json', dummyReferenceJson('Satz A'));
    expect(store.sets.filter((set) => set.name === 'Satz A')).toHaveLength(1);
  });

  it('meldet fehlerhafte Dateien und behält die bisherigen Sätze', async () => {
    const store = useReferenceStore();
    await store.importFile('a.json', dummyReferenceJson('Satz A'));
    await store.importFile('kaputt.json', '{"format":"x"}');
    expect(store.error).toContain('Unbekanntes Format');
    expect(store.sets).toHaveLength(1);
    await store.importFile('kaputt.json', dummyReferenceJson('Satz B'));
    expect(store.error).toBeNull();
  });

  it('meldet unbekannte Fehler allgemein', async () => {
    const store = useReferenceStore();
    // Ein Wert, der keine Zeichenkette ist, löst einen TypeError aus der Dateiauswahl aus.
    await store.importFile('a.json', null as unknown as string);
    expect(store.error).not.toBeNull();
  });

  it('behält importierte Sätze, wenn das Laden erst danach fertig wird', async () => {
    const slowList = Promise.withResolvers<ReferenceSet[]>();
    setReferenceStorage({
      list: () => slowList.promise,
      save: () => Promise.resolve(),
      remove: () => Promise.resolve(),
    });
    const store = useReferenceStore();
    const loading = store.load();
    await store.importFile('neu.json', dummyReferenceJson('Neu'));
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

  it('wählt nur vorhandene Sätze', async () => {
    const store = useReferenceStore();
    await store.importFile('a.json', dummyReferenceJson('Satz A'));
    store.select('gibt es nicht');
    expect(store.selectedName).toBe('Satz A');
    await store.importFile('b.json', dummyReferenceJson('Satz B'));
    store.select('Satz A');
    expect(store.selected?.name).toBe('Satz A');
  });

  it('löscht Sätze und wählt einen anderen', async () => {
    const store = useReferenceStore();
    await store.importFile('a.json', dummyReferenceJson('Satz A'));
    await store.importFile('b.json', dummyReferenceJson('Satz B'));
    await store.remove('Satz B');
    expect(store.selectedName).toBe('Satz A');
    await store.remove('Satz A');
    expect(store.selectedName).toBeNull();
    await store.remove('Satz Z');
    expect(await storage.list()).toEqual([]);
  });

  it('arbeitet mit Warnung weiter, wenn der Speicher ausfällt', async () => {
    setReferenceStorage(failingStorage());
    const store = useReferenceStore();
    await store.load();
    expect(store.warning).toContain('geladen');
    await store.importFile('a.json', dummyReferenceJson('Satz A'));
    expect(store.selected?.name).toBe('Satz A');
    expect(store.warning).toContain('nur für diese Sitzung');
    await store.remove('Satz A');
    expect(store.warning).toContain('gelöscht');
  });

  it('nutzt ohne Austausch den IndexedDB-Speicher des Browsers', async () => {
    setReferenceStorage(null);
    const store = useReferenceStore();
    // Die Testumgebung hat kein IndexedDB: das Laden schlägt ab und wird gemeldet.
    await store.load();
    expect(store.warning).not.toBeNull();
  });

  describe('mitgelieferter Satz', () => {
    it('ist auch ohne funktionierenden Speicher da', async () => {
      setReferenceStorage(failingStorage());
      const store = useReferenceStore();
      await store.load();
      expect(store.warning).not.toBeNull();
      expect(store.selected?.name).toBe(BUNDLED_NAME);
    });

    it('wird von einem eigenen Satz gleichen Namens ersetzt', async () => {
      await storage.save({ name: BUNDLED_NAME, patches: { '1A': [50, 0, 0] } });
      const store = useReferenceStore();
      await store.load();
      expect(store.sets).toHaveLength(1);
      expect(Object.keys(store.selected?.patches ?? {})).toEqual(['1A']);
    });
  });

  describe('Download', () => {
    it('speichert den gewählten Satz als importierbare JSON-Datei', async () => {
      download.mockReset();
      const store = useReferenceStore();
      await store.importFile('a.json', dummyReferenceJson('Satz A'));
      store.downloadSelected();
      const [name, content, mime] = download.mock.calls[0] as [string, string, string];
      expect(name).toBe('Satz A.json');
      expect(mime).toBe('application/json');
      setActivePinia(createPinia());
      const again = useReferenceStore();
      await again.importFile(name, content);
      expect(again.selected?.patches).toEqual(store.selected?.patches);
    });

    it('tut ohne gewählten Satz nichts', () => {
      download.mockReset();
      useReferenceStore().downloadSelected();
      expect(download).not.toHaveBeenCalled();
    });
  });
});
