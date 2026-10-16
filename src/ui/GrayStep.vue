<script setup lang="ts">
import { storeToRefs } from 'pinia';

import { useChartStore } from '../chart/chart-store';
import { grayLayout } from '../chart/layouts';

import BrightnessScale from './BrightnessScale.vue';
import CardStage from './CardStage.vue';

const emit = defineEmits<{ continue: [] }>();

const chart = useChartStore();
const { exposure } = storeToRefs(chart);

const CARD_NAMES = { 3: 'linke Graukarte (50 %)', 4: 'rechte Graukarte (18 %)' };
const IDLE_TEXT =
  'Beide Graukarten ruhig vor die Kamera halten und ein Standbild aufnehmen. Die Eckpunkte werden danach auf dem Standbild gesetzt.';
</script>

<template>
  <section class="lg:grid lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start lg:gap-6">
    <aside class="space-y-3 pb-4 lg:col-start-2 lg:row-start-1 lg:pb-0">
      <p class="text-sm text-slate-700">
        Dieser Tab stellt die Raumhelligkeit ein. Nimm im Tab „Kamera“ oder hier ein Standbild der
        beiden Graukarten auf, markiere darauf die Eckpunkte (die Reihenfolge der Klicks ist egal,
        die App ordnet sie selbst) und ändere dann das Licht, bis die Marke der Skala neben dem Bild
        im umrahmten Zielbereich steht (Details beim Überfahren der Skala). Danach kannst du zum
        Livebild zurückkehren: Solange die Karten nicht bewegt werden, misst die App dort laufend
        mit denselben Eckpunkten.
      </p>
    </aside>

    <div class="min-w-0 lg:col-start-1 lg:row-start-1">
      <CardStage
        :store="chart"
        :layout="grayLayout"
        :card-names="CARD_NAMES"
        :idle-text="IDLE_TEXT"
        live-measure
      >
        <template #side>
          <BrightnessScale :exposure="exposure" />
        </template>
        <template #actions>
          <button
            type="button"
            class="rounded bg-slate-800 px-3 py-1 text-sm text-white disabled:opacity-50"
            :disabled="exposure?.verdict !== 'ok'"
            @click="emit('continue')"
          >
            Weiter zu den Farbkarten
          </button>
        </template>
      </CardStage>
    </div>
  </section>
</template>
