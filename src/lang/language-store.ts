import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { LANGUAGE_NAMES } from './locales';
import { readPreference, writePreference } from './preference';

import { i18n, resolveLocale, setLocale, t } from './index';
import type { LanguagePreference } from './index';

// The language choice of the settings: "auto" follows the browser, otherwise the chosen language counts.
// The choice is saved in the browser and applied to the whole app at once.
export const useLanguageStore = defineStore('language', () => {
  const preference = ref<LanguagePreference>(readPreference());
  const locale = computed(() => i18n.global.locale.value);

  // Short text for the closed settings section, e.g. "English (automatic)".
  const summary = computed(() => {
    const language = LANGUAGE_NAMES[locale.value];
    const key = preference.value === 'auto' ? 'language.summaryAuto' : 'language.summary';
    return t(key, { language });
  });

  function choose(next: LanguagePreference): void {
    preference.value = next;
    writePreference(next);
    setLocale(resolveLocale(next));
  }

  // Applies the saved choice at start (sets the `lang` attribute of the page).
  function apply(): void {
    setLocale(resolveLocale(preference.value));
  }

  return { preference, locale, summary, choose, apply };
});
