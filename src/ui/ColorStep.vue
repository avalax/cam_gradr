<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed } from 'vue';

import { useColorChartStore } from '../chart/chart-store';
import { NEUTRAL_IDS, colorLayout } from '../chart/layouts';
import { useReferenceStore } from '../reference/reference-store';
import { useSolveStore } from '../solve/solve-store';

import CardStage from './CardStage.vue';
import ResultReport from './ResultReport.vue';

const chart = useColorChartStore();
const references = useReferenceStore();
const solve = useSolveStore();
const { ready, measurements } = storeToRefs(chart);
const { selected } = storeToRefs(references);
const { result, error: solveError } = storeToRefs(solve);

const CARD_NAMES = {
  1: 'linke Farbkarte (Spalten A–D)',
  2: 'rechte Farbkarte (Spalten E–H)',
};
const IDLE_TEXT =
  'Beide Farbkarten ruhig vor die Kamera halten und ein Standbild aufnehmen. Die Eckpunkte werden danach auf dem Standbild gesetzt.';

const canCompute = computed(
  () => ready.value && selected.value !== null && Object.keys(measurements.value).length > 0,
);

function compute(): void {
  if (selected.value !== null) {
    solve.compute({
      measurements: measurements.value,
      reference: selected.value,
      neutralIds: NEUTRAL_IDS,
    });
  }
}
</script>

<template>
  <section class="space-y-4">
    <div class="lg:grid lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start lg:gap-6">
      <aside class="space-y-3 pb-4 lg:col-start-2 lg:row-start-1 lg:pb-0">
        <p class="text-sm text-slate-700">
          Dieser Tab berechnet die Farbkorrektur. Nimm ein Standbild der beiden Farbkarten auf,
          markiere die Eckpunkte und starte die Berechnung.
        </p>
        <p v-if="selected !== null" class="text-sm text-slate-700" data-testid="reference-active">
          Referenzwerte: {{ selected.name }} ({{ Object.keys(selected.patches).length }} Felder).
          Den Satz wechselst oder importierst du im Menü ⚙ oben rechts.
        </p>
      </aside>

      <div class="min-w-0 lg:col-start-1 lg:row-start-1">
        <CardStage
          :store="chart"
          :layout="colorLayout"
          :card-names="CARD_NAMES"
          :idle-text="IDLE_TEXT"
          :live-measure="false"
        >
          <template #actions>
            <button
              type="button"
              class="rounded bg-slate-800 px-3 py-1 text-sm text-white disabled:opacity-50"
              :disabled="!canCompute"
              @click="compute"
            >
              Farbkorrektur berechnen
            </button>
          </template>
        </CardStage>
      </div>
    </div>

    <p v-if="solveError !== null" class="text-sm text-red-700" role="alert">{{ solveError }}</p>
    <ResultReport v-if="result !== null" :result="result" />
  </section>
</template>
