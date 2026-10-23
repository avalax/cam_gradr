import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { t } from '../lang';

import { readThemePreference, writeThemePreference } from './preference';
import { resolveTheme } from './theme';
import type { Theme, ThemePreference } from './theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

// The appearance of the settings: "system" follows the device, otherwise the choice counts. The
// choice is saved in the browser; the page gets `data-theme="light"` or `"dark"` at once.
export const useThemeStore = defineStore('theme', () => {
  const preference = ref<ThemePreference>(readThemePreference());
  const prefersDark = ref(false);
  const theme = computed<Theme>(() => resolveTheme(preference.value, prefersDark.value));

  // Short text for the closed settings section, e.g. "Dark".
  const summary = computed(() => t(`theme.options.${preference.value}`));

  function render(): void {
    document.documentElement.dataset.theme = theme.value;
    document.documentElement.style.colorScheme = theme.value;
  }

  function choose(next: ThemePreference): void {
    preference.value = next;
    writeThemePreference(next);
    render();
  }

  // Applies the saved choice at start and follows the device while the choice is "system".
  function apply(): void {
    const query = matchMedia(DARK_QUERY);
    prefersDark.value = query.matches;
    query.addEventListener('change', (event) => {
      prefersDark.value = event.matches;
      render();
    });
    render();
  }

  return { preference, theme, summary, choose, apply };
});
