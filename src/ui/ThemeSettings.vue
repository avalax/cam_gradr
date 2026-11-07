<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { THEME_PREFERENCES } from '../theme/theme';
import { useThemeStore } from '../theme/theme-store';

import ChoiceChips from './ChoiceChips.vue';

const { t } = useI18n();
const store = useThemeStore();
const { preference } = storeToRefs(store);

const options = computed(() =>
  THEME_PREFERENCES.map((value) => ({
    key: value,
    value,
    label: t(`theme.options.${value}`),
  })),
);
</script>

<template>
  <section class="space-y-2">
    <ChoiceChips
      :options="options"
      :selected="preference"
      :aria-label="t('theme.label')"
      data-testid="theme-options"
      @choose="store.choose"
    />
    <p class="text-xs text-zinc-500">{{ t('theme.hint') }}</p>
  </section>
</template>
