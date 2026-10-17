import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { COLOR_IDS, NEUTRAL_IDS } from '../chart/layouts';
import { APP_ID } from '../ui/app-info';
import { downloadFile } from '../lut/download';

import { BUNDLED_FILE_NAME, BUNDLED_NAME, bundledReferenceText } from './bundled';
import { parseReferenceFile, serializeReferenceJson } from './reference';
import type { ReferenceSet } from './reference';
import { createIndexedDbStorage } from './storage';
import type { ReferenceStorage } from './storage';

const rules = { knownIds: COLOR_IDS, neutralIds: NEUTRAL_IDS };

const holder: { storage: ReferenceStorage | null } = { storage: null };

// Austauschpunkt für Tests; im Betrieb wird IndexedDB des Browsers genutzt.
export function setReferenceStorage(next: ReferenceStorage | null): void {
  holder.storage = next;
}

function storage(): ReferenceStorage {
  holder.storage ??= createIndexedDbStorage(indexedDB, APP_ID);
  return holder.storage;
}

export const useReferenceStore = defineStore('reference', () => {
  const sets = ref<ReferenceSet[]>([]);
  const selectedName = ref<string | null>(null);
  const error = ref<string | null>(null);
  const warning = ref<string | null>(null);
  // Name des Satzes, der zuletzt erfolgreich lokal gespeichert wurde.
  const lastSaved = ref<string | null>(null);
  // Name des Satzes, der zuletzt erfolgreich aus dem lokalen Speicher gelöscht wurde.
  const lastRemoved = ref<string | null>(null);

  const selected = computed(
    () => sets.value.find((set) => set.name === selectedName.value) ?? null,
  );

  // Lädt die lokal gespeicherten Referenzsätze. Der mitgelieferte Satz ist immer dabei und
  // vorgewählt, solange nichts anderes gewählt ist; ein gleichnamiger eigener Satz hat Vorrang.
  async function load(): Promise<void> {
    try {
      const stored = await storage().list();
      // Zwischenzeitlich importierte Sätze gehen vor (das Laden kann länger dauern als ein Import).
      const local = sets.value;
      sets.value = [
        ...stored.filter((set) => local.every((existing) => existing.name !== set.name)),
        ...local,
      ];
    } catch {
      warning.value = 'Gespeicherte Referenzen konnten nicht geladen werden.';
    }
    if (sets.value.every((set) => set.name !== BUNDLED_NAME)) {
      sets.value = [
        parseReferenceFile(BUNDLED_FILE_NAME, bundledReferenceText(), rules),
        ...sets.value,
      ];
    }
    selectedName.value ??= BUNDLED_NAME;
  }

  // Liest eine Datei, prüft sie und speichert sie lokal (ein Satz gleichen Namens wird ersetzt).
  async function importFile(fileName: string, text: string): Promise<void> {
    error.value = null;
    warning.value = null;
    try {
      const set = parseReferenceFile(fileName, text, rules);
      sets.value = [...sets.value.filter((existing) => existing.name !== set.name), set];
      selectedName.value = set.name;
      try {
        await storage().save(set);
        lastSaved.value = set.name;
      } catch {
        warning.value =
          'Der Satz konnte nicht lokal gespeichert werden und gilt nur für diese Sitzung.';
      }
    } catch (error_) {
      // Die Prüfung wirft ausschließlich Error-Objekte mit verständlicher Meldung.
      error.value = (error_ as Error).message;
    }
  }

  // Speichert den gewählten Satz als JSON-Datei, damit er sich später oder anderswo importieren lässt.
  function downloadSelected(): void {
    const set = selected.value;
    if (set !== null) {
      downloadFile(`${set.name}.json`, serializeReferenceJson(set), 'application/json');
    }
  }

  function select(name: string): void {
    if (sets.value.some((set) => set.name === name)) {
      selectedName.value = name;
    }
  }

  async function remove(name: string): Promise<void> {
    sets.value = sets.value.filter((set) => set.name !== name);
    if (selectedName.value === name) {
      selectedName.value = sets.value[0]?.name ?? null;
    }
    try {
      await storage().remove(name);
      lastRemoved.value = name;
    } catch {
      warning.value = 'Der Satz konnte lokal nicht gelöscht werden.';
    }
  }

  return {
    sets,
    selectedName,
    selected,
    error,
    warning,
    lastSaved,
    lastRemoved,
    load,
    importFile,
    downloadSelected,
    select,
    remove,
  };
});
