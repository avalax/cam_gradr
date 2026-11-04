import { describe, expect, it, vi } from 'vitest';

import { languagePreference } from '../lang/preference';
import { themePreference } from '../theme/preference';

import { storedPreference } from './stored-preference';

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      data.set(key, value);
    }),
  };
}

const isShade = (value: unknown): value is 'light' | 'dark' =>
  value === 'light' || value === 'dark';
const shade = storedPreference('shade', isShade, 'light');

describe('storedPreference', () => {
  it('writes the choice under the key of the app and reads it again', () => {
    const storage = memory();
    shade.write('dark', storage);
    expect(storage.setItem).toHaveBeenCalledWith('avalax.cam_gradr.shade', 'dark');
    expect(shade.read(storage)).toBe('dark');
  });

  it('falls back when nothing or something unknown is saved', () => {
    expect(shade.read(memory())).toBe('light');
    expect(shade.read(memory({ 'avalax.cam_gradr.shade': 'xx' }))).toBe('light');
    expect(shade.read(null)).toBe('light');
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
    expect(shade.read(blocked)).toBe('light');
    expect(() => {
      shade.write('dark', blocked);
    }).not.toThrow();
    expect(() => {
      shade.write('dark', null);
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
      expect(shade.read()).toBe('light');
      expect(() => {
        shade.write('dark');
      }).not.toThrow();
    } finally {
      if (descriptor !== undefined) {
        Object.defineProperty(globalThis, 'localStorage', descriptor);
      }
    }
  });

  it('keeps language and appearance under the keys of earlier versions', () => {
    const storage = memory({ 'avalax.cam_gradr.language': 'en', 'avalax.cam_gradr.theme': 'dark' });
    expect(languagePreference.read(storage)).toBe('en');
    expect(themePreference.read(storage)).toBe('dark');
    expect(languagePreference.read(memory())).toBe('auto');
    expect(themePreference.read(memory())).toBe('system');
  });
});
