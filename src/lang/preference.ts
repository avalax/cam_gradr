import { APP_ID } from '../ui/app-info';

import { isPreference } from './locales';
import type { LanguagePreference } from './locales';

const STORAGE_KEY = `${APP_ID}.language`;

// Reads the saved language choice; anything unknown, or a blocked or empty storage, gives "auto".
export function readPreference(
  storage: Pick<Storage, 'getItem'> | null = browserStorage(),
): LanguagePreference {
  try {
    const stored = storage?.getItem(STORAGE_KEY);
    return isPreference(stored) ? stored : 'auto';
  } catch {
    // Blocked storage (private window, site data blocked): the app works without it.
    return 'auto';
  }
}

export function writePreference(
  preference: LanguagePreference,
  storage: Pick<Storage, 'setItem'> | null = browserStorage(),
): void {
  try {
    storage?.setItem(STORAGE_KEY, preference);
  } catch {
    // The choice then only counts for this session.
  }
}

function browserStorage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}
