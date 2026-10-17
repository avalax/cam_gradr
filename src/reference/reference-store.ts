import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { COLOR_IDS, NEUTRAL_IDS } from '../chart/layouts';
import { APP_ID } from '../ui/app-info';
import { downloadFile } from '../lut/download';

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

// Austauschpunkt für Tests; im Betrieb wird fetch des Browsers genutzt.
const fetcher: { fetch: typeof fetch | null } = { fetch: null };

export function setReferenceFetch(next: typeof fetch | null): void {
  fetcher.fetch = next;
}

function parseUrl(text: string): URL | null {
  try {
    const url = new URL(text.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null;
  } catch {
    return null;
  }
}

// Dateiname aus dem Pfad der Adresse; er bestimmt Format (JSON/CSV) und Namen ohne "name"-Feld.
function fileNameOf(url: URL): string {
  const last = url.pathname.split('/').findLast((part) => part !== '') ?? '';
  return decodeURIComponent(last) || 'Import';
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
  const loading = ref(false);

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

  // Lädt eine Referenzdatei von einer Internetadresse. Die Werte stammen vom Nutzer und werden
  // nur lokal im Browser gespeichert; es gibt bewusst keine voreingestellte Adresse.
  async function importUrl(address: string): Promise<void> {
    error.value = null;
    warning.value = null;
    const url = parseUrl(address);
    if (url === null) {
      error.value = 'Bitte eine gültige Adresse mit https:// angeben.';
      return;
    }
    loading.value = true;
    try {
      const response = await (fetcher.fetch ?? fetch)(url, {
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      });
      if (!response.ok) {
        error.value = `Der Abruf ist fehlgeschlagen (HTTP ${String(response.status)}).`;
        return;
      }
      await importFile(fileNameOf(url), await response.text());
    } catch {
      error.value =
        'Die Datei konnte nicht geladen werden. Der Server muss Abrufe von anderen Seiten erlauben (CORS).';
    } finally {
      loading.value = false;
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
    loading,
    load,
    importFile,
    importUrl,
    downloadSelected,
    select,
    remove,
  };
});
