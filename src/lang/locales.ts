// Languages of the user interface. To add a language: create `<code>.json` in this folder and register
// it here and in `index.ts`. The test `messages.test.ts` checks that all languages have the same keys.
export const SUPPORTED_LOCALES = ['en', 'de'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

// If no supported language matches the browser, English is used.
export const DEFAULT_LOCALE: Locale = 'en';

// The choice in the settings: a language or "auto" (follow the browser setting).
export type LanguagePreference = Locale | 'auto';

// Language names in the language itself; they are never translated.
export const LANGUAGE_NAMES: Readonly<Record<Locale, string>> = {
  en: 'English',
  de: 'Deutsch',
};

export function isLocale(value: unknown): value is Locale {
  return (SUPPORTED_LOCALES as readonly unknown[]).includes(value);
}

export function isPreference(value: unknown): value is LanguagePreference {
  return value === 'auto' || isLocale(value);
}

// Picks the first supported language from the browser languages (`navigator.languages`, most preferred
// first). The region does not count: "de-AT" gives "de".
export function detectLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const primary = language.toLowerCase().split('-', 1)[0];
    const match = SUPPORTED_LOCALES.find((locale) => locale === primary);
    if (match !== undefined) {
      return match;
    }
  }
  return DEFAULT_LOCALE;
}
