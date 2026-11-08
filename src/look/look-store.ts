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
  | { kind: 'removeFailed' }
  | { kind: 'storeFailed' };

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
    // A look that looks like a log conversion gets the warning instead of a place in the line that
    // names the imported looks. Errors and warnings come first, that line last: the room under the
    // bar shows two lines, and what needs attention has to be in them.
    const warnings: LookMessage[] = [];
    const plain: string[] = [];
    for (const look of imported) {
      if (isLogConversion(look.name)) {
        warnings.push({ kind: 'logConversion', name: look.name });
      } else {
        plain.push(look.name);
      }
    }
    const last = imported.at(-1);
    if (last !== undefined) {
      usePreviewStore().setLook(last.name);
    }
    const report: LookMessage[] = plain.length > 0 ? [{ kind: 'imported', names: plain }] : [];
    removed.value = null;
    messages.value = [...problems, ...warnings, ...report];
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

  // Makes the look LUTs of a project file the whole list, also in the browser's storage: looks the
  // file does not have are deleted, looks of the same name are replaced by the file's. Returns how
  // many were deleted.
  async function replaceAll(saved: readonly LookLut[]): Promise<number> {
    looks.value = saved.toSorted(byName);
    removed.value = null;
    messages.value = [];
    const keep = new Set(saved.map((look) => look.name));
    let gone = 0;
    try {
      const stored = await storage().list();
      for (const look of stored) {
        if (!keep.has(look.name)) {
          await storage().remove(look.name);
          gone += 1;
        }
      }
      for (const look of saved) {
        await storage().save(look);
      }
    } catch {
      messages.value = [{ kind: 'storeFailed' }];
    }
    return gone;
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

  return { looks, messages, find, load, importFiles, replaceAll, remove, undo, dismiss };
});
