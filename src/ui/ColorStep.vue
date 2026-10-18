<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, watch } from 'vue';

import { useChartStore, useColorChartStore } from '../chart/chart-store';
import { NEUTRAL_IDS, colorLayout, grayLayout } from '../chart/layouts';
import { useReferenceStore } from '../reference/reference-store';
import { checkGrayCards } from '../solve/gray-check';
import { useSolveStore } from '../solve/solve-store';

import CardStage from './CardStage.vue';
import ColorWipe from './ColorWipe.vue';
import ResultReport from './ResultReport.vue';

const chart = useColorChartStore();
const grayChart = useChartStore();
const references = useReferenceStore();
const solve = useSolveStore();
const { ready, measurements } = storeToRefs(chart);
const { selected } = storeToRefs(references);
const { result, error: solveError, model } = storeToRefs(solve);

// Kontrolle mit den Graukarten aus Schritt 1 (nur mit Korrektur und gemessenen Graukarten).
const grayCheck = computed(() =>
  model.value === null ? [] : checkGrayCards(model.value, grayChart.measurements, grayLayout),
);

const CARD_NAMES = {
  1: 'linke Farbkarte (Spalten A–D)',
  2: 'rechte Farbkarte (Spalten E–H)',
};
const IDLE_TEXT =
  'Beide Farbkarten ruhig vor die Kamera halten und ein Standbild aufnehmen. Die Eckpunkte werden danach auf dem Standbild gesetzt.';

function compute(): void {
  if (selected.value !== null) {
    solve.compute({
      measurements: measurements.value,
      reference: selected.value,
      neutralIds: NEUTRAL_IDS,
    });
  }
}

// Die Korrektur wird bei jeder Änderung neu berechnet: neue Eckpunkte (und damit neue Messwerte)
// oder ein anderer Referenzsatz.
watch([measurements, selected], () => {
  if (ready.value && Object.keys(measurements.value).length > 0) {
    compute();
  }
});
</script>

<template>
  <section class="space-y-4">
    <div class="lg:grid lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start lg:gap-6">
      <aside class="space-y-3 pb-4 lg:col-start-2 lg:row-start-1 lg:pb-0">
        <p class="text-sm text-slate-700">
          Dieser Tab berechnet die Farbkorrektur. Nimm ein Standbild der beiden Farbkarten auf,
          markiere die Eckpunkte. Die Farbkorrektur wird dann automatisch berechnet und bei jeder
          Änderung der Eckpunkte neu.
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
          <template #side>
            <ColorWipe
              :layout="colorLayout"
              :measurements="measurements"
              :model="model"
              :reference="selected"
              :report="result?.report ?? null"
            />
          </template>
        </CardStage>
      </div>
    </div>

    <p v-if="solveError !== null" class="text-sm text-red-700" role="alert">{{ solveError }}</p>
    <ResultReport v-if="result !== null" :result="result" :gray-check="grayCheck" />
  </section>
</template>
