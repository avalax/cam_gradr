<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { useSolveStore } from '../solve/solve-store';

// The one place of the correction setting: preview and export both show this box, so the setting is
// the same everywhere in the application. The compact form puts the options in one row and leaves
// out the explanations (they stay as tooltips).
defineProps<{ compact?: boolean }>();

const { t } = useI18n();
const solve = useSolveStore();
const { tone, canChangeTone } = storeToRefs(solve);

const toneModel = computed({
  get: () => tone.value,
  set: (value: boolean) => {
    solve.setTone(value);
  },
});
const summary = computed(() =>
  t('correction.active', {
    parts: t(tone.value ? 'correction.partsTone' : 'correction.partsColor'),
  }),
);
</script>

<template>
  <fieldset
    class="rounded border border-zinc-300 bg-zinc-50 p-2 text-xs text-zinc-800"
    :class="compact ? 'flex flex-wrap items-center gap-x-4 gap-y-1' : 'space-y-2'"
    data-testid="correction-options"
  >
    <legend class="px-1 font-semibold">{{ t('correction.title') }}</legend>
    <label
      class="flex items-start gap-2 opacity-75"
      :title="compact ? t('correction.baseHint') : undefined"
    >
      <input type="checkbox" class="mt-0.5" checked disabled />
      <span>
        {{ t('correction.base') }}
        <small v-if="!compact" class="block text-[11px] leading-snug text-zinc-600">{{
          t('correction.baseHint')
        }}</small>
      </span>
    </label>
    <label
      class="flex items-start gap-2"
      :class="{ 'opacity-75': !canChangeTone }"
      :title="
        canChangeTone
          ? compact
            ? t('correction.toneHint')
            : undefined
          : t('correction.toneLocked')
      "
    >
      <input
        v-model="toneModel"
        type="checkbox"
        class="mt-0.5"
        :disabled="!canChangeTone"
        data-testid="correction-tone"
      />
      <span>
        {{ t('correction.tone') }}
        <small v-if="!compact" class="block text-[11px] leading-snug text-zinc-600">{{
          t('correction.toneHint')
        }}</small>
      </span>
    </label>
    <p v-if="!compact" class="text-[11px] text-zinc-600" data-testid="correction-summary">
      {{ summary }}
    </p>
  </fieldset>
</template>
