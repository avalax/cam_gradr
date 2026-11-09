import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';

import { onLocaleChange, t } from '../lang';
import { APP_ID } from '../ui/app-info';
import { downloadFile } from '../lut/download';
import { createIndexedDbStorage } from '../storage/indexed-db';
import type { NamedStorage } from '../storage/indexed-db';

import { BUNDLED_NAME, bundledReference } from './bundled';
import { parseReferenceFile, serializeReferenceJson } from './reference';
import type { ReferenceSet } from './reference';

// A file chosen in the dialog: its name and a way to read it.
interface ChosenFile {
  name: string;
  text: () => Promise<string>;
}

const holder: { storage: NamedStorage<ReferenceSet> | null } = { storage: null };

// Swap point for tests; in operation the browser's IndexedDB is used.
export function setReferenceStorage(next: NamedStorage<ReferenceSet> | null): void {
  holder.storage = next;
}

function storage(): NamedStorage<ReferenceSet> {
  holder.storage ??= createIndexedDbStorage(indexedDB, APP_ID, 'references');
  return holder.storage;
}

export const useReferenceStore = defineStore('reference', () => {
  const sets = ref<ReferenceSet[]>([]);
  const selectedName = ref<string | null>(null);
  // Why the import failed: a file the browser cannot read, translated when read, or the problem
  // the validation names. The validation puts its text together deep in the parser, in the
  // language of the moment, so that text cannot follow a language switch and goes away with it.
  const failure = shallowRef<{ key: 'unreadable' } | { key: 'invalid'; text: string } | null>(null);
  const error = computed(() => {
    const current = failure.value;
    if (current === null) {
      return null;
    }
    return current.key === 'invalid' ? current.text : t('reference.errors.unreadable');
  });
  // A problem of the local storage: the key of its text, translated when read.
  const warningKey = ref<'loadFailed' | 'saveFailed' | 'removeFailed' | null>(null);
  const warning = computed(() =>
    warningKey.value === null ? null : t(`reference.warnings.${warningKey.value}`),
  );
  // Name of the set that was last saved locally successfully.
  const lastSaved = ref<string | null>(null);
  // Name of the set that was last deleted from local storage successfully.
  const lastRemoved = ref<string | null>(null);

  onLocaleChange(() => {
    if (failure.value?.key === 'invalid') {
      failure.value = null;
    }
  });

  // Each action of the panel shows only its own outcome.
  function clearOutcome(): void {
    failure.value = null;
    warningKey.value = null;
    lastSaved.value = null;
    lastRemoved.value = null;
  }

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
      warningKey.value = 'loadFailed';
    }
    if (sets.value.every((set) => set.name !== BUNDLED_NAME)) {
      sets.value = [bundledReference(), ...sets.value];
    }
    selectedName.value ??= BUNDLED_NAME;
  }

  // Reads a file, validates it and saves it locally (a set of the same name is replaced).
  async function importFile(fileName: string, text: string): Promise<void> {
    clearOutcome();
    try {
      const set = parseReferenceFile(fileName, text);
      sets.value = [...sets.value.filter((existing) => existing.name !== set.name), set];
      selectedName.value = set.name;
      try {
        await storage().save(set);
        lastSaved.value = set.name;
      } catch {
        warningKey.value = 'saveFailed';
      }
    } catch (error_) {
      // The validation throws only Error objects with an understandable message.
      failure.value = { key: 'invalid', text: (error_ as Error).message };
    }
  }

  // Reads a file chosen in the dialog and imports it; a file the browser cannot read (moved or
  // locked since it was chosen) is reported as such.
  async function importChosen(file: ChosenFile): Promise<void> {
    let text: string;
    try {
      text = await file.text();
    } catch {
      clearOutcome();
      failure.value = { key: 'unreadable' };
      return;
    }
    await importFile(file.name, text);
  }

  // Saves a set as a JSON file so it can be imported later or elsewhere.
  function download(set: ReferenceSet): void {
    downloadFile(`${set.name}.json`, serializeReferenceJson(set), 'application/json');
  }

  // Selects a set, also when a project is loaded: what the panel reports stays.
  function select(name: string): void {
    if (sets.value.some((set) => set.name === name)) {
      selectedName.value = name;
    }
  }

  // The choice in the panel, which shows only its own outcome.
  function choose(name: string): void {
    clearOutcome();
    select(name);
  }

  async function remove(name: string): Promise<void> {
    clearOutcome();
    sets.value = sets.value.filter((set) => set.name !== name);
    if (selectedName.value === name) {
      selectedName.value = sets.value[0]?.name ?? null;
    }
    try {
      await storage().remove(name);
      lastRemoved.value = name;
    } catch {
      warningKey.value = 'removeFailed';
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
    importChosen,
    download,
    select,
    choose,
    remove,
  };
});
