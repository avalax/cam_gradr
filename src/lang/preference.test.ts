import { describe, expect, it, vi } from 'vitest';

import { readPreference, writePreference } from './preference';

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      data.set(key, value);
    }),
  };
}

describe('preference', () => {
  it('reads a saved language', () => {
    const storage = memory({ 'avalax.cam_gradr.language': 'de' });
    expect(readPreference(storage)).toBe('de');
  });

  it('picks “auto” when nothing or something unknown is saved', () => {
    expect(readPreference(memory())).toBe('auto');
    expect(readPreference(memory({ 'avalax.cam_gradr.language': 'xx' }))).toBe('auto');
    expect(readPreference(null)).toBe('auto');
  });

  it('keeps working without storage when it is blocked', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readPreference(blocked)).toBe('auto');
    expect(() => {
      writePreference('en', blocked);
    }).not.toThrow();
    expect(() => {
      writePreference('en', null);
    }).not.toThrow();
  });

  it('keeps working without storage when even accessing localStorage fails', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('blocked');
      },
    });
    try {
      expect(readPreference()).toBe('auto');
      expect(() => {
        writePreference('de');
      }).not.toThrow();
    } finally {
      if (descriptor !== undefined) {
        Object.defineProperty(globalThis, 'localStorage', descriptor);
      }
    }
  });

  it('writes the choice under the key of the app', () => {
    const storage = memory();
    writePreference('en', storage);
    expect(storage.setItem).toHaveBeenCalledWith('avalax.cam_gradr.language', 'en');
    expect(readPreference(storage)).toBe('en');
  });
});
