<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { Measurements } from '../chart/measure';
import type { ChartLayout } from '../chart/types';
import type { ReferenceSet } from '../reference/reference';
import type { ColorModel, FitResult } from '../solve/fit';

import { buildStrips } from './color-strips';
import { byRowThenColumn, deviationSummary } from './gray-wedge';
import WipeDivider from './WipeDivider.vue';

const { t } = useI18n();

const props = defineProps<{
  layout: ChartLayout;
  measurements: Measurements;
  model: ColorModel | null;
  reference: ReferenceSet | null;
  report: FitResult['report'] | null;
}>();

// Position of the divider: camera colors on the left, corrected ones on the right.
const split = ref(50);

// The cards are stacked, each with four columns.
const cards = computed(() =>
  props.layout.cards.map((card) => card.patches.map((patch) => patch.id).toSorted(byRowThenColumn)),
);

const strips = computed(() =>
  buildStrips(cards.value.flat(), props.measurements, props.model, props.reference),
);
// Whether a patch is measured is determined by the camera layer (only for the hover description).
const measuredIds = computed(
  () => new Set(strips.value.camera.filter((swatch) => swatch.measured).map((swatch) => swatch.id)),
);
const layers = computed(() =>
  [
    { key: 'camera', label: t('color.wipe.cameraLayer'), swatches: strips.value.camera },
    { key: 'corrected', label: t('color.wipe.correctedLayer'), swatches: strips.value.corrected },
  ].map((layer) => ({
    ...layer,
    byId: new Map(layer.swatches.map((swatch) => [swatch.id, swatch])),
  })),
);

const summary = computed(() =>
  props.report === null ? t('color.wipe.noCorrection') : deviationSummary(props.report),
);
</script>

<template>
  <!-- Wipe over the color cards: camera colors left of the divider, corrected ones on the right. -->
  <div
    class="relative flex w-44 shrink-0 flex-col self-stretch rounded-lg border border-zinc-500 bg-zinc-50"
    data-testid="color-wipe"
  >
    <p
      class="rounded-t-[7px] border-b-[3px] border-zinc-700 bg-zinc-200 px-2 py-1.5 text-center text-[11px] font-semibold leading-tight text-zinc-800"
    >
      {{ t('color.wipe.caption') }}
    </p>

    <div class="relative min-h-64 flex-1 overflow-hidden">
      <div
        v-for="(layer, index) in layers"
        :key="layer.key"
        class="absolute inset-0 flex flex-col gap-1.5 bg-zinc-50 p-[3px]"
        :style="index === 0 ? undefined : { clipPath: `inset(0 0 0 ${String(split)}%)` }"
        role="img"
        :aria-label="layer.label"
        :data-testid="`color-wipe-${layer.key}`"
        :data-measured="layer.swatches.some((swatch) => swatch.measured)"
      >
        <div
          v-for="(ids, cardIndex) in cards"
          :key="cardIndex"
          class="grid min-h-0 flex-1 grid-cols-4 gap-[3px]"
        >
          <div
            v-for="id in ids"
            :key="id"
            :style="{ background: layer.byId.get(id)?.css }"
            :title="measuredIds.has(id) ? id : t('color.wipe.defaultValue', { id })"
            :data-patch="id"
          ></div>
        </div>
      </div>

      <WipeDivider v-model="split" :label="t('color.wipe.divider')" />
    </div>

    <!-- The summary is also the trigger: on hover or keyboard focus the color correction result
              appears as a popup (like the details on the gray cards' measuring field). -->
    <div
      class="group relative rounded-b-[7px] outline-offset-2 focus-visible:outline"
      :tabindex="report === null ? undefined : 0"
      data-testid="color-wipe-result"
    >
      <p
        class="rounded-b-[7px] border-t-[3px] border-zinc-700 bg-zinc-200 px-2 py-1.5 text-center text-[11px] font-semibold leading-tight text-zinc-800"
        data-testid="color-wipe-summary"
      >
        {{ summary }}
      </p>
      <div
        v-if="report !== null && $slots.details"
        class="absolute bottom-0 right-full z-20 hidden pr-3 group-focus-within:block group-hover:block"
        role="tooltip"
        data-testid="color-wipe-popup"
      >
        <div
          class="max-h-[min(30rem,calc(100vh-17rem))] w-[min(36rem,calc(100vw-14rem))] overflow-auto rounded bg-slate-900 p-3 text-sm text-white shadow-lg"
        >
          <slot name="details" />
        </div>
      </div>
    </div>
  </div>
</template>
