<script setup lang="ts">
import { computed, ref } from 'vue';

import type { Measurements } from '../chart/measure';
import type { ChartLayout } from '../chart/types';
import type { ReferenceSet } from '../reference/reference';
import type { ColorModel, FitResult } from '../solve/fit';

import { buildStrips } from './color-strips';
import { byRowThenColumn, deviationSummary } from './gray-wedge';
import WipeDivider from './WipeDivider.vue';

const props = defineProps<{
  layout: ChartLayout;
  measurements: Measurements;
  model: ColorModel | null;
  reference: ReferenceSet | null;
  report: FitResult['report'] | null;
}>();

// Lage des Strichs: links die Farben der Kamera, rechts die korrigierten.
const split = ref(50);

// Die Karten stehen untereinander, jede mit vier Spalten.
const cards = computed(() =>
  props.layout.cards.map((card) => card.patches.map((patch) => patch.id).toSorted(byRowThenColumn)),
);

const strips = computed(() =>
  buildStrips(cards.value.flat(), props.measurements, props.model, props.reference),
);
// Ob ein Feld gemessen ist, bestimmt die Kamera-Ebene (nur für die Beschreibung beim Überfahren).
const measuredIds = computed(
  () => new Set(strips.value.camera.filter((swatch) => swatch.measured).map((swatch) => swatch.id)),
);
const layers = computed(() =>
  [
    { key: 'camera', label: 'Farben der Kamera', swatches: strips.value.camera },
    { key: 'corrected', label: 'Farben nach der Korrektur', swatches: strips.value.corrected },
  ].map((layer) => ({
    ...layer,
    byId: new Map(layer.swatches.map((swatch) => [swatch.id, swatch])),
  })),
);

const summary = computed(() =>
  props.report === null ? 'Noch keine Korrektur' : deviationSummary(props.report),
);
</script>

<template>
  <!-- Wischer über die Farbkarten: links vom Strich die Farben der Kamera, rechts die korrigierten. -->
  <div
    class="relative flex w-44 shrink-0 flex-col self-stretch rounded-lg border border-zinc-500 bg-zinc-50"
    data-testid="color-wipe"
  >
    <p
      class="rounded-t-[7px] border-b-[3px] border-zinc-700 bg-zinc-200 px-2 py-1.5 text-center text-[11px] font-semibold leading-tight text-zinc-800"
    >
      links Kamera · rechts korrigiert
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
            :title="`${id}${measuredIds.has(id) ? '' : ' (Standardwert)'}`"
            :data-patch="id"
          ></div>
        </div>
      </div>

      <WipeDivider v-model="split" label="Wischer: Farben der Kamera links, korrigierte rechts" />
    </div>

    <!-- Die Zusammenfassung ist zugleich der Auslöser: Beim Überfahren oder per Tastaturfokus erscheint
         das Ergebnis der Farbkorrektur als Popup (wie die Details beim Messfeld der Graukarten). -->
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
