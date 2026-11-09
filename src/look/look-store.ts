import { defineStore } from 'pinia';
import { shallowRef } from 'vue';

import { usePreviewStore } from '../lut/preview-store';
import { createIndexedDbStorage } from '../storage/indexed-db';
import type { NamedStorage } from '../storage/indexed-db';
import { APP_ID } from '../ui/app-info';

import { LookError, isCubeFile, isLogConversion, parseLookCube } from './look';
import type { LookLut, LookProblem } from './look';

// What the bar under the preview reports after an action; the texts come from the language files
// when shown, so that they follow a language switch.
export type LookMessage =
  | { kind: 'imported'; names: string[] }
  | { kind: 'rejected'; file: string; reason: LookProblem }
  // `fallback` is the look the preview shows again when this one is removed through the warning.
  | { kind: 'logConversion'; name: string; fallback: string | null }
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

  // The warnings about log conversions that are shown, but not the one about this look.
  function warningsExcept(name: string): LookMessage[] {
    return messages.value.filter(
      (message) => message.kind === 'logConversion' && message.name !== name,
    );
  }

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
    const before = usePreviewStore().look;
    const imported: LookLut[] = [];
    const problems: LookMessage[] = [];
    for (const file of files) {
      if (!isCubeFile(file.name)) {
        problems.push({
          kind: 'rejected',
          file: file.name,
          reason: { key: 'notCube', params: {} },
        });
        continue;
      }
      try {
        const look = parseLookCube(file.name, await file.text());
        put(look);
        imported.push(look);
        await save(look, problems);
      } catch (error) {
        // The parser names the problem; a file the browser cannot read (moved or locked since it
        // was chosen) has none of its own.
        const reason: LookProblem =
          error instanceof LookError ? error.problem : { key: 'unreadable', params: {} };
        problems.push({ kind: 'rejected', file: file.name, reason });
      }
    }
    // A look that looks like a log conversion gets the warning instead of a place in the line that
    // names the imported looks. Errors and warnings come first, that line last: the room under the
    // bar shows two lines, and what needs attention has to be in them. Removed through the warning,
    // the look gives way to the one the import would otherwise have chosen: the last other look of
    // this import, or the look from before.
    const plain = imported.filter((look) => !isLogConversion(look.name)).map((look) => look.name);
    const fallback = plain.at(-1) ?? before;
    const warnings: LookMessage[] = imported
      .filter((look) => isLogConversion(look.name))
      .map((look) => ({ kind: 'logConversion', name: look.name, fallback }));
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
    // Warnings about other looks of the same import stay below the line about this one.
    const others = warningsExcept(name);
    messages.value = [{ kind: 'removed', name }, ...others];
    try {
      await storage().remove(name);
    } catch {
      messages.value = [{ kind: 'removeFailed' }, ...others];
    }
  }

  // Removes a look the import warned about; if it was chosen, the preview shows the look it took the
  // place of (see importFiles). The trash removes a look without that.
  async function removeWarned(name: string, fallback: string | null): Promise<void> {
    const preview = usePreviewStore();
    const chosen = preview.look === name;
    const removing = remove(name);
    if (chosen && find(fallback) !== null) {
      preview.setLook(fallback);
    }
    await removing;
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
    const others = warningsExcept(last.look.name);
    const report: LookMessage[] = [];
    await save(last.look, report);
    messages.value = [...report, ...others];
  }

  function dismiss(): void {
    messages.value = [];
  }

  return {
    looks,
    messages,
    find,
    load,
    importFiles,
    replaceAll,
    remove,
    removeWarned,
    undo,
    dismiss,
  };
});
