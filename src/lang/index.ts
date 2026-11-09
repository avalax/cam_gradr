import { createI18n } from 'vue-i18n';

import enApp from './en/app.json' with { type: 'json' };
import enCamera from './en/camera.json' with { type: 'json' };
import enSettings from './en/settings.json' with { type: 'json' };
import enLanguage from './en/language.json' with { type: 'json' };
import enReference from './en/reference.json' with { type: 'json' };
import enProject from './en/project.json' with { type: 'json' };
import enExport from './en/export.json' with { type: 'json' };
import enCards from './en/cards.json' with { type: 'json' };
import enMeasure from './en/measure.json' with { type: 'json' };
import enColor from './en/color.json' with { type: 'json' };
import enPreview from './en/preview.json' with { type: 'json' };
import enReport from './en/report.json' with { type: 'json' };
import enWedge from './en/wedge.json' with { type: 'json' };
import enSolve from './en/solve.json' with { type: 'json' };
import enTheme from './en/theme.json' with { type: 'json' };
import enLook from './en/look.json' with { type: 'json' };
import deApp from './de/app.json' with { type: 'json' };
import deCamera from './de/camera.json' with { type: 'json' };
import deSettings from './de/settings.json' with { type: 'json' };
import deLanguage from './de/language.json' with { type: 'json' };
import deReference from './de/reference.json' with { type: 'json' };
import deProject from './de/project.json' with { type: 'json' };
import deExport from './de/export.json' with { type: 'json' };
import deCards from './de/cards.json' with { type: 'json' };
import deMeasure from './de/measure.json' with { type: 'json' };
import deColor from './de/color.json' with { type: 'json' };
import dePreview from './de/preview.json' with { type: 'json' };
import deReport from './de/report.json' with { type: 'json' };
import deWedge from './de/wedge.json' with { type: 'json' };
import deSolve from './de/solve.json' with { type: 'json' };
import deTheme from './de/theme.json' with { type: 'json' };
import deLook from './de/look.json' with { type: 'json' };
import { DEFAULT_LOCALE, detectLocale } from './locales';
import type { LanguagePreference, Locale } from './locales';
import { languagePreference } from './preference';

const en = {
  app: enApp,
  camera: enCamera,
  settings: enSettings,
  language: enLanguage,
  reference: enReference,
  project: enProject,
  export: enExport,
  cards: enCards,
  measure: enMeasure,
  color: enColor,
  preview: enPreview,
  report: enReport,
  wedge: enWedge,
  solve: enSolve,
  theme: enTheme,
  look: enLook,
};

// `en` is the reference: its keys type every `t('…')` call. `messages.test.ts` checks that the
// placeholders match.
type MessageSchema = typeof en;

// The same messages, at every level with only the keys of the reference: `never` for an extra key.
type SameKeys<T, Reference> = T extends string
  ? string
  : { [K in keyof T]: K extends keyof Reference ? SameKeys<T[K], Reference[K]> : never };

// Takes a translation only if it has exactly the keys of English: a missing or an extra key does
// not compile.
function translation<T extends MessageSchema>(messages: T & SameKeys<T, MessageSchema>): T {
  return messages;
}

const de = translation({
  app: deApp,
  camera: deCamera,
  settings: deSettings,
  language: deLanguage,
  reference: deReference,
  project: deProject,
  export: deExport,
  cards: deCards,
  measure: deMeasure,
  color: deColor,
  preview: dePreview,
  report: deReport,
  wedge: deWedge,
  solve: deSolve,
  theme: deTheme,
  look: deLook,
});

export const messages = { en, de };

declare module 'vue-i18n' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- the documented way to type keys
  export interface DefineLocaleMessage extends MessageSchema {}
}

// The language for a preference: the browser language for "auto", otherwise the chosen one.
export function resolveLocale(
  preference: LanguagePreference,
  languages: readonly string[] = navigator.languages,
): Locale {
  return preference === 'auto' ? detectLocale(languages) : preference;
}

export const i18n = createI18n({
  legacy: false,
  locale: resolveLocale(languagePreference.read()),
  fallbackLocale: DEFAULT_LOCALE,
  messages,
});

// Translates outside of components (stores, helpers, error messages).
export const t = i18n.global.t;

// Switches the language of the whole app, including the `lang` attribute of the page.
export function setLocale(locale: Locale): void {
  i18n.global.locale.value = locale;
  document.documentElement.lang = locale;
}

export { SUPPORTED_LOCALES, LANGUAGE_NAMES } from './locales';
export type { LanguagePreference, Locale } from './locales';
