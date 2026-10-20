import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LOCALE,
  LANGUAGE_NAMES,
  SUPPORTED_LOCALES,
  detectLocale,
  isLocale,
  isPreference,
} from './locales';

describe('detectLocale', () => {
  it('takes the first supported browser language', () => {
    expect(detectLocale(['de-DE', 'en-US'])).toBe('de');
    expect(detectLocale(['fr-FR', 'en-GB', 'de'])).toBe('en');
  });

  it('ignores region and letter case', () => {
    expect(detectLocale(['DE-at'])).toBe('de');
    expect(detectLocale(['en'])).toBe('en');
  });

  it('falls back to English without a matching language', () => {
    expect(detectLocale([])).toBe(DEFAULT_LOCALE);
    expect(detectLocale(['fr-FR', 'ja'])).toBe('en');
    expect(DEFAULT_LOCALE).toBe('en');
  });
});

describe('language choice', () => {
  it('recognizes languages and the choice “auto”', () => {
    expect(isLocale('de')).toBe(true);
    expect(isLocale('fr')).toBe(false);
    expect(isLocale(null)).toBe(false);
    expect(isPreference('auto')).toBe(true);
    expect(isPreference('en')).toBe(true);
    expect(isPreference('klingon')).toBe(false);
  });

  it('names each language in its own language', () => {
    expect(
      Object.keys(LANGUAGE_NAMES).toSorted((a: string, b: string) => a.localeCompare(b)),
    ).toEqual(SUPPORTED_LOCALES.toSorted((a: string, b: string) => a.localeCompare(b)));
    expect(LANGUAGE_NAMES.de).toBe('Deutsch');
    expect(LANGUAGE_NAMES.en).toBe('English');
  });
});
