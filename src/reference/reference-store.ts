import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { COLOR_IDS, NEUTRAL_IDS } from '../chart/layouts';
import { APP_ID } from '../ui/app-info';

import { parseReferenceFile } from './reference';
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

  const selected = computed(
    () => sets.value.find((set) => set.name === selectedName.value) ?? null,
  );

  // Lädt die lokal gespeicherten Referenzsätze und wählt den ersten, falls noch keiner gewählt ist.
  async function load(): Promise<void> {
    try {
      const stored = await storage().list();
      // Zwischenzeitlich importierte Sätze gehen vor (das Laden kann länger dauern als ein Import).
      const local = sets.value;
      sets.value = [
        ...stored.filter((set) => local.every((existing) => existing.name !== set.name)),
        ...local,
      ];
      selectedName.value ??= sets.value[0]?.name ?? null;
    } catch {
      warning.value = 'Gespeicherte Referenzen konnten nicht geladen werden.';
    }
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
    load,
    importFile,
    select,
    remove,
  };
});
