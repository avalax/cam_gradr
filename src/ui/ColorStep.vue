<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { useCameraStore } from '../camera/camera-store';
import { useChartStore, useColorChartStore } from '../chart/chart-store';
import { colorLayout } from '../chart/layouts';
import { useReferenceStore } from '../reference/reference-store';
import { checkGrayCards } from '../solve/gray-check';
import type { FitResult } from '../solve/fit';
import { useSolveStore } from '../solve/solve-store';

import CardStage from './CardStage.vue';
import ColorWipe from './ColorWipe.vue';
import { TAB_COLUMNS } from './image-size';
import { hasReferenceSet, referenceLabel } from './reference-label';
import ResultReport from './ResultReport.vue';

const { t } = useI18n();
const chart = useColorChartStore();
const grayChart = useChartStore();
const references = useReferenceStore();
const solve = useSolveStore();
const { still } = storeToRefs(useCameraStore());
// Without a still image of this tab (live image or no image at all) there is nothing to compare yet.
const live = computed(() => still.value === null);
const { measurements } = storeToRefs(chart);
const { selected, sets } = storeToRefs(references);
const { result, error: solveError, model, referenceName } = storeToRefs(solve);
// A correction without a report whose set the browser does not have (loaded from a project) names
// that set, marked as missing, instead of the active one.
const missingSet = computed(() => {
  const name = referenceName.value;
  const withoutReport = model.value !== null && result.value === null;
  return withoutReport && name !== null && !hasReferenceSet(name, sets.value) ? name : null;
});

// Check against the gray cards from step 1 (for a calculated correction, empty without measured
// gray cards), at the exposure of the color shot.
function grayCheck(current: FitResult) {
  return checkGrayCards(current.model, grayChart.measurements, current.report.exposureGain);
}
</script>

<template>
  <section :class="TAB_COLUMNS">
    <aside class="space-y-3 pb-4 lg:col-start-2 lg:row-start-1 lg:pb-0">
      <p class="text-sm text-zinc-700">
        {{ t('color.intro') }}
      </p>
      <p v-if="missingSet !== null" class="text-sm text-zinc-700" data-testid="reference-active">
        {{ t('color.referenceMissing', { name: referenceLabel(missingSet) }) }}
      </p>
      <p v-else-if="selected !== null" class="text-sm text-zinc-700" data-testid="reference-active">
        {{
          t('color.referenceActive', {
            name: referenceLabel(selected.name),
            count: Object.keys(selected.patches).length,
          })
        }}
      </p>
      <!-- In the text column, as the error of the preview: under the image it would make the tab
           taller. -->
      <p v-if="solveError !== null" class="text-sm text-red-700 dark:text-red-400" role="alert">
        {{ solveError }}
      </p>
    </aside>

    <div class="min-w-0 lg:col-start-1 lg:row-start-1">
      <CardStage
        :store="chart"
        :layout="colorLayout"
        :wrong-text="t('color.wrong')"
        :wrong-label="t('color.wrongLabel')"
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
              <ResultReport
                v-if="result !== null"
                :result="result"
                :gray-check="grayCheck(result)"
              />
            </template>
          </ColorWipe>
        </template>
      </CardStage>
    </div>
  </section>
</template>
