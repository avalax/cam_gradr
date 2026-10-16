import { IDBFactory } from 'fake-indexeddb';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { dummyReferenceCsv, dummyReferenceJson } from '../test-support/dummy-reference';

import { setReferenceStorage, useReferenceStore } from './reference-store';
import { createIndexedDbStorage } from './storage';
import type { ReferenceStorage } from './storage';

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

  it('ist zu Beginn leer', async () => {
    const store = useReferenceStore();
    await store.load();
    expect(store.sets).toEqual([]);
    expect(store.selected).toBeNull();
  });

  it('importiert, wählt und speichert einen Satz lokal', async () => {
    const store = useReferenceStore();
    await store.importFile('a.json', dummyReferenceJson('Satz A'));
    expect(store.error).toBeNull();
    expect(store.selected?.name).toBe('Satz A');
    const saved = await storage.list();
    expect(saved.map((set) => set.name)).toEqual(['Satz A']);
  });

  it('lädt gespeicherte Sätze beim Start und wählt den ersten', async () => {
    const first = useReferenceStore();
    await first.importFile('a.json', dummyReferenceJson('Satz A'));
    setActivePinia(createPinia());
    const again = useReferenceStore();
    await again.load();
    expect(again.selectedName).toBe('Satz A');
    await again.load();
    expect(again.sets).toHaveLength(1);
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
});
