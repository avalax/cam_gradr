<script setup lang="ts">
import { computed } from 'vue';

import type { Measurements } from '../chart/measure';
import type { ReferenceSet } from '../reference/reference';
import type { ColorModel } from '../solve/fit';

import { buildStrips } from './color-strips';

const props = defineProps<{
  ids: readonly string[];
  measurements: Measurements;
  model: ColorModel | null;
  reference: ReferenceSet | null;
}>();

const strips = computed(() =>
  buildStrips(props.ids, props.measurements, props.model, props.reference),
);
const columns = computed(() => [
  {
    key: 'camera',
    label: 'Farben der Kamera',
    swatches: strips.value.camera,
  },
  {
    key: 'corrected',
    label: 'Farben nach der Korrektur',
    swatches: strips.value.corrected,
  },
]);
</script>

<template>
  <!-- Zwei senkrechte Farbleisten wie die Helligkeitsskala: links die gemessenen Farben, rechts die korrigierten. -->
  <div
    class="flex w-14 shrink-0 gap-1 self-stretch"
    role="group"
    aria-label="Farbfelder: links Kamera, rechts korrigiert"
    data-testid="color-strips"
  >
    <div
      v-for="column in columns"
      :key="column.key"
      class="flex min-h-64 flex-1 flex-col overflow-hidden rounded border border-slate-500"
      role="img"
      :aria-label="column.label"
      :data-testid="`color-strip-${column.key}`"
      :data-measured="column.swatches.some((swatch) => swatch.measured)"
    >
      <div
        v-for="swatch in column.swatches"
        :key="swatch.id"
        class="min-h-0 flex-1"
        :class="swatch.measured ? '' : 'opacity-50'"
        :style="{ background: swatch.css }"
        :title="`${swatch.id}${swatch.measured ? '' : ' (Standardwert)'}`"
        :data-patch="swatch.id"
      ></div>
    </div>
  </div>
</template>
