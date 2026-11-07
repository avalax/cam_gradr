<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { LANGUAGE_NAMES, SUPPORTED_LOCALES } from '../lang';
import { useLanguageStore } from '../lang/language-store';

import ChoiceChips from './ChoiceChips.vue';

const { t } = useI18n();
const store = useLanguageStore();
const { preference } = storeToRefs(store);

// "auto" first, then every language under its own name (the names are never translated).
const options = computed(() => [
  { key: 'auto', value: 'auto' as const, label: t('language.auto') },
  ...SUPPORTED_LOCALES.map((value) => ({
    key: value,
    value,
    label: LANGUAGE_NAMES[value],
    lang: value,
  })),
]);
</script>

<template>
  <section class="space-y-2">
    <ChoiceChips
      :options="options"
      :selected="preference"
      :aria-label="t('language.label')"
      data-testid="language-options"
      @choose="store.choose"
    />
    <p class="text-xs text-zinc-500">{{ t('language.hint') }}</p>
  </section>
</template>
