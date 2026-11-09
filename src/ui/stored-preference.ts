import { APP_ID } from './app-info';

// A choice of the settings that the browser keeps (language, appearance).
interface StoredPreference<T extends string> {
  read: (storage?: Pick<Storage, 'getItem'> | null) => T;
  write: (preference: T, storage?: Pick<Storage, 'setItem'> | null) => void;
}

// Keeps the choice under `<app>.<name>`. Anything unknown, or a blocked or empty storage, gives the
// fallback.
export function storedPreference<T extends string>(
  name: string,
  isValid: (value: unknown) => value is T,
  fallback: T,
): StoredPreference<T> {
  const key = `${APP_ID}.${name}`;
  return {
    read: (storage = browserStorage()) => {
      try {
        const stored = storage?.getItem(key);
        return isValid(stored) ? stored : fallback;
      } catch {
        // Blocked storage (private window, site data blocked): the app works without it.
        return fallback;
      }
    },
    write: (preference, storage = browserStorage()) => {
      try {
        storage?.setItem(key, preference);
      } catch {
        // The choice then only counts for this session.
      }
    },
  };
}

function browserStorage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}
