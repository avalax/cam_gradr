import { APP_ID } from '../ui/app-info';

import { isThemePreference } from './theme';
import type { ThemePreference } from './theme';

const STORAGE_KEY = `${APP_ID}.theme`;

// Reads the saved choice; anything unknown, or a blocked or empty storage, gives "system".
export function readThemePreference(
  storage: Pick<Storage, 'getItem'> | null = browserStorage(),
): ThemePreference {
  try {
    const stored = storage?.getItem(STORAGE_KEY);
    return isThemePreference(stored) ? stored : 'system';
  } catch {
    // Blocked storage (private window, site data blocked): the app works without it.
    return 'system';
  }
}

export function writeThemePreference(
  preference: ThemePreference,
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
