import { t } from '../lang';
import { BUNDLED_NAME } from '../reference/bundled';

// How the interface names a reference set: the bundled set under a label in the language of the app,
// every other set under its own name. The stored name of the bundled set stays as it is, because
// project files and downloaded sets carry it as the key.
export function referenceLabel(name: string): string {
  return name === BUNDLED_NAME ? t('reference.names.bundled') : name;
}

// Whether the browser has the set of this name.
export function hasReferenceSet(name: string, sets: readonly { name: string }[]): boolean {
  return sets.some((set) => set.name === name);
}

// The set a correction was fitted with, marked while the browser does not have it (a correction
// loaded from a project whose set is missing here); a dash without one.
export function fittedReferenceLabel(
  name: string | null,
  sets: readonly { name: string }[],
): string {
  if (name === null) {
    return '–';
  }
  const label = referenceLabel(name);
  return hasReferenceSet(name, sets) ? label : t('reference.names.missing', { name: label });
}
