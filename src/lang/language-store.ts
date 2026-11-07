import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { LANGUAGE_NAMES } from './locales';
import { languagePreference } from './preference';

import { i18n, resolveLocale, setLocale, t } from './index';
import type { LanguagePreference } from './index';

// The language choice of the settings: "auto" follows the browser, otherwise the chosen language counts.
// The choice is saved in the browser and applied to the whole app at once.
export const useLanguageStore = defineStore('language', () => {
  const preference = ref<LanguagePreference>(languagePreference.read());

  // Short text for the closed settings section, e.g. "English (automatic)".
  const summary = computed(() => {
    const language = LANGUAGE_NAMES[i18n.global.locale.value];
    return preference.value === 'auto' ? t('language.summaryAuto', { language }) : language;
  });

  function choose(next: LanguagePreference): void {
    preference.value = next;
    languagePreference.write(next);
    setLocale(resolveLocale(next));
  }

  // Applies the saved choice at start (sets the `lang` attribute of the page).
  function apply(): void {
    setLocale(resolveLocale(preference.value));
  }

  return { preference, summary, choose, apply };
});
