import { describe, expect, it, vi } from 'vitest';

import { readThemePreference, writeThemePreference } from './preference';

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      data.set(key, value);
    }),
  };
}

describe('theme preference', () => {
  it('reads a saved choice and writes it', () => {
    const storage = memory({ 'avalax.cam_gradr.theme': 'dark' });
    expect(readThemePreference(storage)).toBe('dark');
    writeThemePreference('light', storage);
    expect(readThemePreference(storage)).toBe('light');
  });

  it('picks “system” when nothing or something unknown is saved', () => {
    expect(readThemePreference(memory())).toBe('system');
    expect(readThemePreference(memory({ 'avalax.cam_gradr.theme': 'blue' }))).toBe('system');
    expect(readThemePreference(null)).toBe('system');
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
    expect(readThemePreference(blocked)).toBe('system');
    expect(() => {
      writeThemePreference('dark', blocked);
    }).not.toThrow();
    expect(() => {
      writeThemePreference('dark', null);
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
      expect(readThemePreference()).toBe('system');
      expect(() => {
        writeThemePreference('dark');
      }).not.toThrow();
    } finally {
      if (descriptor !== undefined) {
        Object.defineProperty(globalThis, 'localStorage', descriptor);
      }
    }
  });
});
