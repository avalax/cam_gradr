<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { Measurements } from '../chart/measure';
import type { ChartLayout } from '../chart/types';
import type { ReferenceSet } from '../reference/reference';
import type { ColorModel, FitResult } from '../solve/fit';

import { buildStrips } from './color-strips';
import { byRowThenColumn, deviationSummary } from './gray-wedge';
import { usePopupDismiss } from './popup-dismiss';
import WipeDivider from './WipeDivider.vue';
import WipeLabels from './WipeLabels.vue';

const { t } = useI18n();

const props = defineProps<{
  layout: ChartLayout;
  measurements: Measurements;
  model: ColorModel | null;
  reference: ReferenceSet | null;
  report: FitResult['report'] | null;
  // The live image is shown: nothing to compare yet, so only the camera colors and no divider.
  live: boolean;
}>();

// Position of the divider: camera colors on the left, corrected ones on the right.
const split = ref(50);
const { dismissed, onKey, reset } = usePopupDismiss();

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

// While the live image runs, the corrected layer and the divider would show nothing meaningful.
const shownLayers = computed(() => (props.live ? layers.value.slice(0, 1) : layers.value));

// A correction without a report (loaded from a project whose reference set is missing) says so: its
// colors are corrected, only the deviations are unknown.
const summary = computed(() => {
  if (props.report !== null) {
    return deviationSummary(props.report);
  }
  return t(props.model === null ? 'color.wipe.noCorrection' : 'color.wipe.noReport');
});
</script>

<template>
  <!-- Wipe over the color cards: camera colors left of the divider, corrected ones on the right. -->
  <div class="flex flex-col rounded-lg border border-zinc-500 bg-zinc-50" data-testid="color-wipe">
    <p
      v-if="live"
      class="rounded-t-[7px] border-b-(length:--band-line) border-zinc-700 bg-zinc-200 px-2 py-1.5 text-center text-[11px] font-semibold leading-tight text-zinc-800"
    >
      {{ t('color.wipe.liveCaption') }}
    </p>
    <WipeLabels v-else :split="split" class="rounded-t-[7px]" />

    <div class="relative min-h-0 flex-1 overflow-hidden">
      <div
        v-for="(layer, index) in shownLayers"
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

      <WipeDivider
        v-if="!live"
        v-model="split"
        :label="t('color.wipe.divider')"
        :left-name="t('color.wipe.cameraLayer')"
      />
    </div>

    <!-- The summary is also the trigger: on hover or keyboard focus the color correction result
         appears as a popup over the image beside the column, like the details on the gray cards'
         measuring field. It is placed against the image row (IMAGE_ROW, whose side column is
         11 rem wide): at most as wide as the image, so it never leaves the window, and within the
         height of the row, so it never covers the tabs. It starts at the bottom, where the trigger
         is, so that the pointer can move into it to scroll. The Tab key also moves into it to scroll
         (its ring is drawn inside, where it shows on the dark popup over the image); a click does
         not focus the trigger, so it does not keep the result open once the pointer leaves. Escape
         closes it. -->
    <!-- eslint-disable-next-line vuejs-accessibility/no-static-element-interactions -- the focusable trigger of the result closes it with Escape -->
    <div
      class="group rounded-b-[7px]"
      :tabindex="report === null ? undefined : 0"
      data-testid="color-wipe-result"
      @keydown="onKey"
      @mousedown.prevent
      @mouseleave="reset"
      @focusout="reset"
    >
      <p
        class="rounded-b-[7px] border-t-(length:--band-line) border-zinc-700 bg-zinc-200 px-2 py-1.5 text-center text-[11px] font-semibold leading-tight text-zinc-800"
        data-testid="color-wipe-summary"
      >
        {{ summary }}
      </p>
      <div
        v-if="report !== null && $slots.details && !dismissed"
        class="absolute bottom-0 left-0 right-[11rem] z-20 hidden max-h-full flex-col items-end pr-3 group-hover:flex group-focus-within:flex"
        role="tooltip"
        data-testid="color-wipe-popup"
      >
        <div
          class="focus-ring-inset min-h-0 w-full max-w-[36rem] overflow-auto rounded bg-zinc-950 p-3 text-sm text-white shadow-lg"
        >
          <slot name="details" />
        </div>
      </div>
    </div>
  </div>
</template>
