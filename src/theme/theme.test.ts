import { describe, expect, it } from 'vitest';

import { isThemePreference, resolveTheme } from './theme';

describe('theme', () => {
  it('knows the three choices', () => {
    expect(['system', 'light', 'dark'].every((value) => isThemePreference(value))).toBe(true);
    expect(isThemePreference('auto')).toBe(false);
    expect(isThemePreference(undefined)).toBe(false);
  });

  it('follows the device for “system” and otherwise the choice', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});
