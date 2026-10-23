<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';

import { THEME_PREFERENCES } from '../theme/theme';
import { useThemeStore } from '../theme/theme-store';

const { t } = useI18n();
const store = useThemeStore();
const { preference } = storeToRefs(store);
</script>

<template>
  <section class="space-y-2">
    <div
      role="radiogroup"
      :aria-label="t('theme.label')"
      class="flex flex-wrap gap-1.5"
      data-testid="theme-options"
    >
      <button
        v-for="option in THEME_PREFERENCES"
        :key="option"
        type="button"
        role="radio"
        class="rounded-full border px-3 py-0.5 text-xs"
        :class="
          preference === option
            ? 'border-zinc-800 bg-zinc-800 text-zinc-50'
            : 'border-zinc-400 bg-white text-zinc-800 dark:bg-zinc-100'
        "
        :aria-checked="preference === option"
        :data-theme-option="option"
        @click="store.choose(option)"
      >
        {{ t(`theme.options.${option}`) }}
      </button>
    </div>
    <p class="text-xs text-zinc-500">{{ t('theme.hint') }}</p>
  </section>
</template>
