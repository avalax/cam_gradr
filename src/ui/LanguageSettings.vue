<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { LANGUAGE_NAMES, SUPPORTED_LOCALES } from '../lang';
import type { LanguagePreference } from '../lang';
import { useLanguageStore } from '../lang/language-store';

const { t } = useI18n();
const store = useLanguageStore();
const { preference } = storeToRefs(store);

// "auto" first, then every language under its own name (the names are never translated).
const options = computed<{ value: LanguagePreference; label: string }[]>(() => [
  { value: 'auto', label: t('language.auto') },
  ...SUPPORTED_LOCALES.map((value) => ({ value, label: LANGUAGE_NAMES[value] })),
]);
</script>

<template>
  <section class="space-y-2">
    <div
      role="radiogroup"
      :aria-label="t('language.label')"
      class="flex flex-wrap gap-1.5"
      data-testid="language-options"
    >
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        role="radio"
        class="rounded-full border px-3 py-0.5 text-xs"
        :class="
          preference === option.value
            ? 'border-zinc-800 bg-zinc-800 text-zinc-50'
            : 'border-zinc-400 bg-white dark:bg-zinc-100 text-zinc-800'
        "
        :aria-checked="preference === option.value"
        :lang="option.value === 'auto' ? undefined : option.value"
        :data-language="option.value"
        @click="store.choose(option.value)"
      >
        {{ option.label }}
      </button>
    </div>
    <p class="text-xs text-zinc-500">{{ t('language.hint') }}</p>
  </section>
</template>
