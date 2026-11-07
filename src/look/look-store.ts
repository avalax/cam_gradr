import { defineStore } from 'pinia';
import { shallowRef } from 'vue';

import { t } from '../lang';
import { usePreviewStore } from '../lut/preview-store';
import { createIndexedDbStorage } from '../storage/indexed-db';
import type { NamedStorage } from '../storage/indexed-db';
import { APP_ID } from '../ui/app-info';

import { isCubeFile, isLogConversion, parseLookCube } from './look';
import type { LookLut } from './look';

// What the bar under the preview reports after an action; the texts come from the language files
// when shown, so that they follow a language switch.
export type LookMessage =
  | { kind: 'imported'; names: string[] }
  | { kind: 'rejected'; file: string; reason: string }
  | { kind: 'logConversion'; name: string }
  | { kind: 'removed'; name: string }
  | { kind: 'loadFailed' }
  | { kind: 'saveFailed'; name: string }
  | { kind: 'removeFailed' };

// A file chosen in the dialog: its name and a way to read it.
interface LookFile {
  name: string;
  text: () => Promise<string>;
}

const holder: { storage: NamedStorage<LookLut> | null } = { storage: null };

// Swap point for tests; in operation the browser's IndexedDB is used.
export function setLookStorage(next: NamedStorage<LookLut> | null): void {
  holder.storage = next;
}

function storage(): NamedStorage<LookLut> {
  holder.storage ??= createIndexedDbStorage(indexedDB, APP_ID, 'looks');
  return holder.storage;
}

function byName(first: LookLut, second: LookLut): number {
  return first.name.localeCompare(second.name);
}

// The imported look LUTs, sorted by name. Which one the preview uses and how strongly is set in
// the preview store, since a project file saves it with the other preview settings.
export const useLookStore = defineStore('look', () => {
  // Shallow: the LUT data are large arrays that need no reactivity of their own.
  const looks = shallowRef<LookLut[]>([]);
  const messages = shallowRef<LookMessage[]>([]);
  // The last deleted look, which "Undo" brings back.
  const removed = shallowRef<{ look: LookLut; selected: boolean } | null>(null);

  function find(name: string | null): LookLut | null {
    return looks.value.find((look) => look.name === name) ?? null;
  }

  function put(look: LookLut): void {
    looks.value = [...looks.value.filter((entry) => entry.name !== look.name), look].toSorted(
      byName,
    );
  }

  async function load(): Promise<void> {
    try {
      const stored = await storage().list();
      // Looks imported in the meantime take precedence.
      const local = looks.value;
      looks.value = [
        ...stored.filter((look) => local.every((entry) => entry.name !== look.name)),
        ...local,
      ].toSorted(byName);
    } catch {
      messages.value = [{ kind: 'loadFailed' }];
    }
  }

  async function save(look: LookLut, report: LookMessage[]): Promise<void> {
    try {
      await storage().save(look);
    } catch {
      report.push({ kind: 'saveFailed', name: look.name });
    }
  }

  // Reads the chosen files; each valid one is saved (a look of the same name is replaced) and the
  // last one is chosen in the preview. Invalid files are named with the reason.
  async function importFiles(files: readonly LookFile[]): Promise<void> {
    const imported: LookLut[] = [];
    const problems: LookMessage[] = [];
    for (const file of files) {
      if (!isCubeFile(file.name)) {
        problems.push({ kind: 'rejected', file: file.name, reason: t('look.errors.notCube') });
        continue;
      }
      try {
        const look = parseLookCube(file.name, await file.text());
        put(look);
        imported.push(look);
        await save(look, problems);
      } catch (error) {
        // The parser throws only Error objects with an understandable message.
        problems.push({ kind: 'rejected', file: file.name, reason: (error as Error).message });
      }
    }
    const report: LookMessage[] = [];
    const last = imported.at(-1);
    if (last !== undefined) {
      usePreviewStore().setLook(last.name);
      report.push({ kind: 'imported', names: imported.map((look) => look.name) });
      const conversions = imported.filter((entry) => isLogConversion(entry.name));
      report.push(
        ...conversions.map((look) => ({ kind: 'logConversion', name: look.name }) as const),
      );
    }
    removed.value = null;
    messages.value = [...report, ...problems];
  }

  async function remove(name: string): Promise<void> {
    const look = find(name);
    if (look === null) {
      return;
    }
    const preview = usePreviewStore();
    const selected = preview.look === name;
    looks.value = looks.value.filter((entry) => entry !== look);
    if (selected) {
      preview.setLook(null);
    }
    removed.value = { look, selected };
    messages.value = [{ kind: 'removed', name }];
    try {
      await storage().remove(name);
    } catch {
      messages.value = [{ kind: 'removeFailed' }];
    }
  }

  // Takes over the look LUTs of a project file that this browser does not have yet and saves them;
  // a look of the same name in the browser stays.
  async function adopt(saved: readonly LookLut[]): Promise<void> {
    const report: LookMessage[] = [];
    const missing = saved.filter((entry) => find(entry.name) === null);
    for (const look of missing) {
      put(look);
      await save(look, report);
    }
    if (report.length > 0) {
      messages.value = report;
    }
  }

  // Brings the last deleted look back, chosen again if it was chosen before.
  async function undo(): Promise<void> {
    const last = removed.value;
    if (last === null) {
      return;
    }
    removed.value = null;
    put(last.look);
    if (last.selected) {
      usePreviewStore().setLook(last.look.name);
    }
    const report: LookMessage[] = [];
    await save(last.look, report);
    messages.value = report;
  }

  function dismiss(): void {
    messages.value = [];
  }

  return { looks, messages, find, load, importFiles, adopt, remove, undo, dismiss };
});
