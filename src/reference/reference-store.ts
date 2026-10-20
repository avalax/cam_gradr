import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { COLOR_IDS, NEUTRAL_IDS } from '../chart/layouts';
import { t } from '../lang';
import { APP_ID } from '../ui/app-info';
import { downloadFile } from '../lut/download';

import { BUNDLED_FILE_NAME, BUNDLED_NAME, bundledReferenceText } from './bundled';
import { parseReferenceFile, serializeReferenceJson } from './reference';
import type { ReferenceSet } from './reference';
import { createIndexedDbStorage } from './storage';
import type { ReferenceStorage } from './storage';

const rules = { knownIds: COLOR_IDS, neutralIds: NEUTRAL_IDS };

const holder: { storage: ReferenceStorage | null } = { storage: null };

// Swap point for tests; in operation the browser's IndexedDB is used.
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
  // Name of the set that was last saved locally successfully.
  const lastSaved = ref<string | null>(null);
  // Name of the set that was last deleted from local storage successfully.
  const lastRemoved = ref<string | null>(null);

  const selected = computed(
    () => sets.value.find((set) => set.name === selectedName.value) ?? null,
  );

  // Loads the locally saved reference sets. The bundled set is always included and
  // preselected as long as nothing else is selected; a custom set of the same name takes precedence.
  async function load(): Promise<void> {
    try {
      const stored = await storage().list();
      // Sets imported in the meantime take precedence (loading can take longer than an import).
      const local = sets.value;
      sets.value = [
        ...stored.filter((set) => local.every((existing) => existing.name !== set.name)),
        ...local,
      ];
    } catch {
      warning.value = t('reference.warnings.loadFailed');
    }
    if (sets.value.every((set) => set.name !== BUNDLED_NAME)) {
      sets.value = [
        parseReferenceFile(BUNDLED_FILE_NAME, bundledReferenceText(), rules),
        ...sets.value,
      ];
    }
    selectedName.value ??= BUNDLED_NAME;
  }

  // Reads a file, validates it and saves it locally (a set of the same name is replaced).
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
        warning.value = t('reference.warnings.saveFailed');
      }
    } catch (error_) {
      // The validation throws only Error objects with an understandable message.
      error.value = (error_ as Error).message;
    }
  }

  // Saves the selected set as a JSON file so it can be imported later or elsewhere.
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
      warning.value = t('reference.warnings.removeFailed');
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
