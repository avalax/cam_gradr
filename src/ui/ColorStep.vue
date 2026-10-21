<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { useCameraStore } from '../camera/camera-store';
import { useChartStore, useColorChartStore } from '../chart/chart-store';
import { NEUTRAL_IDS, colorLayout, grayLayout } from '../chart/layouts';
import { useReferenceStore } from '../reference/reference-store';
import { checkGrayCards } from '../solve/gray-check';
import { useSolveStore } from '../solve/solve-store';

import CardStage from './CardStage.vue';
import ColorWipe from './ColorWipe.vue';
import ResultReport from './ResultReport.vue';

const { t } = useI18n();
const chart = useColorChartStore();
const grayChart = useChartStore();
const references = useReferenceStore();
const solve = useSolveStore();
const { still } = storeToRefs(useCameraStore());
// Without a still image of this tab (live image or no image at all) there is nothing to compare yet.
const live = computed(() => still.value === null);
const { ready, measurements } = storeToRefs(chart);
const { selected } = storeToRefs(references);
const { result, error: solveError, model } = storeToRefs(solve);

// Check against the gray cards from step 1 (only with a correction and measured gray cards).
const grayCheck = computed(() =>
  model.value === null ? [] : checkGrayCards(model.value, grayChart.measurements, grayLayout),
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

// The correction is recalculated on every change: new corner points (and thus new measurements)
// or a different reference set.
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
          {{ t('color.intro') }}
        </p>
        <p v-if="selected !== null" class="text-sm text-slate-700" data-testid="reference-active">
          {{
            t('color.referenceActive', {
              name: selected.name,
              count: Object.keys(selected.patches).length,
            })
          }}
        </p>
      </aside>

      <div class="min-w-0 lg:col-start-1 lg:row-start-1">
        <CardStage
          :store="chart"
          :layout="colorLayout"
          :idle-text="t('color.idle')"
          :wrong-text="t('color.wrong')"
        >
          <template #side>
            <ColorWipe
              :layout="colorLayout"
              :measurements="measurements"
              :model="model"
              :reference="selected"
              :report="result?.report ?? null"
              :live="live"
            >
              <template #details>
                <ResultReport v-if="result !== null" :result="result" :gray-check="grayCheck" />
              </template>
            </ColorWipe>
          </template>
        </CardStage>
      </div>
    </div>

    <p v-if="solveError !== null" class="text-sm text-red-700" role="alert">{{ solveError }}</p>
  </section>
</template>
