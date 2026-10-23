<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';

import { useChartStore } from '../chart/chart-store';
import { grayLayout } from '../chart/layouts';

import CardStage from './CardStage.vue';
import MeasureField from './MeasureField.vue';

const chart = useChartStore();
const { exposure } = storeToRefs(chart);

const { t } = useI18n();
</script>

<template>
  <section class="lg:grid lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start lg:gap-6">
    <aside class="space-y-3 pb-4 lg:col-start-2 lg:row-start-1 lg:pb-0">
      <p class="text-sm text-slate-700 dark:text-slate-300">
        {{ t('cards.gray.intro') }}
      </p>
    </aside>

    <div class="min-w-0 lg:col-start-1 lg:row-start-1">
      <CardStage
        :store="chart"
        :layout="grayLayout"
        :idle-text="t('cards.gray.idle')"
        :wrong-text="t('cards.gray.wrong')"
        :wrong-label="t('cards.gray.wrongLabel')"
      >
        <template #side>
          <MeasureField :exposure="exposure" />
        </template>
      </CardStage>
    </div>
  </section>
</template>
