<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { formatDecimal } from '../lang/format';
import { labToSrgb } from '../color/lab';
import { applyColorModel } from '../solve/fit';
import type { FitResult } from '../solve/fit';
import type { GrayCheck } from '../solve/gray-check';

import { cssColor } from './color-css';

const { t } = useI18n();
const props = withDefaults(defineProps<{ result: FitResult; grayCheck?: readonly GrayCheck[] }>(), {
  grayCheck: () => [],
});

// From this error (ΔE2000) on the gray cards, the report points to possible causes.
const GRAY_WARN = 3;
const grayNames = computed<Readonly<Record<string, string>>>(() => ({
  G50: t('report.gray50'),
  G18: t('report.gray18'),
}));

const grayRows = computed(() =>
  props.grayCheck.map((check) => ({ ...check, name: grayNames.value[check.id] ?? check.id })),
);
const grayOff = computed(() => props.grayCheck.some((check) => check.after > GRAY_WARN));

function format(value: number): string {
  return formatDecimal(value, 1);
}

// Per patch: target color, camera value and corrected value as color swatches including the error.
const tiles = computed(() =>
  props.result.report.patches.map((patch) => ({
    ...patch,
    referenceCss: cssColor(labToSrgb(patch.reference)),
    cameraCss: cssColor(patch.measured),
    correctedCss: cssColor(applyColorModel(props.result.model, patch.measured)),
  })),
);
</script>

<template>
  <section class="space-y-3" data-testid="report">
    <h3 class="text-base font-semibold">{{ t('report.title') }}</h3>
    <dl class="grid grid-cols-3 gap-x-4 gap-y-1 text-sm" data-testid="report-summary">
      <dt class="font-medium"></dt>
      <dt class="font-medium">{{ t('report.before') }}</dt>
      <dt class="font-medium">{{ t('report.after') }}</dt>
      <dd>{{ t('report.meanError') }}</dd>
      <dd data-testid="mean-before">{{ format(result.report.meanBefore) }}</dd>
      <dd data-testid="mean-after">{{ format(result.report.meanAfter) }}</dd>
      <dd>{{ t('report.maxError') }}</dd>
      <dd data-testid="max-before">{{ format(result.report.maxBefore) }}</dd>
      <dd data-testid="max-after">{{ format(result.report.maxAfter) }}</dd>
      <template v-if="result.report.neutral !== null">
        <dd>{{ t('report.neutralMean', { count: result.report.neutral.count }) }}</dd>
        <dd data-testid="neutral-before">{{ format(result.report.neutral.meanBefore) }}</dd>
        <dd data-testid="neutral-after">{{ format(result.report.neutral.meanAfter) }}</dd>
      </template>
      <template v-if="result.report.color !== null">
        <dd>{{ t('report.colorMean', { count: result.report.color.count }) }}</dd>
        <dd data-testid="color-before">{{ format(result.report.color.meanBefore) }}</dd>
        <dd data-testid="color-after">{{ format(result.report.color.meanAfter) }}</dd>
      </template>
    </dl>

    <p
      v-if="result.report.indistinct.length > 0"
      class="text-xs text-amber-300"
      role="note"
      data-testid="indistinct-warning"
    >
      {{ t('report.indistinct', { patches: result.report.indistinct.join(', ') }) }}
    </p>

    <section v-if="grayRows.length > 0" class="space-y-1 text-sm" data-testid="gray-check">
      <h4 class="font-medium">{{ t('report.grayTitle') }}</h4>
      <p class="text-xs text-slate-300">
        {{ t('report.grayIntro') }}
      </p>
      <ul>
        <li v-for="row in grayRows" :key="row.id" :data-testid="`gray-${row.id}`">
          {{
            t('report.grayRow', {
              name: row.name,
              before: format(row.before),
              after: format(row.after),
            })
          }}
        </li>
      </ul>
      <p v-if="grayOff" class="text-xs text-amber-300" role="note" data-testid="gray-warning">
        {{ t('report.grayWarning') }}
      </p>
    </section>

    <p class="text-xs text-slate-300">
      {{ t('report.tileHelp') }}
    </p>

    <ul class="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-1.5">
      <li
        v-for="tile in tiles"
        :key="tile.id"
        class="rounded border border-slate-600 p-1 text-center text-[10px]"
        :data-testid="`tile-${tile.id}`"
        :title="
          t('report.tileTitle', {
            id: tile.id,
            before: format(tile.before),
            after: format(tile.after),
          })
        "
      >
        <div class="flex h-5 overflow-hidden rounded">
          <span class="flex-1" :style="{ background: tile.referenceCss }"></span>
          <span class="flex-1" :style="{ background: tile.cameraCss }"></span>
          <span class="flex-1" :style="{ background: tile.correctedCss }"></span>
        </div>
        <span class="mt-1 block">{{
          t('report.tileLabel', {
            id: tile.id,
            before: format(tile.before),
            after: format(tile.after),
          })
        }}</span>
      </li>
    </ul>
  </section>
</template>
