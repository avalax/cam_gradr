<script setup lang="ts">
import { storeToRefs } from 'pinia';

import { useChartStore } from '../chart/chart-store';
import { grayLayout } from '../chart/layouts';

import CardStage from './CardStage.vue';
import MeasureField from './MeasureField.vue';

const chart = useChartStore();
const { exposure } = storeToRefs(chart);

const CARD_NAMES = { 3: 'linke Graukarte (50 %)', 4: 'rechte Graukarte (18 %)' };
const IDLE_TEXT = 'Beide Graukarten ruhig in die Rahmen vor die Kamera halten.';
</script>

<template>
  <section class="lg:grid lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start lg:gap-6">
    <aside class="space-y-3 pb-4 lg:col-start-2 lg:row-start-1 lg:pb-0">
      <p class="text-sm text-slate-700">
        Dieser Tab stellt die Raumhelligkeit ein. Schalte oben die Kamera ein und halte die beiden
        Graukarten in die Rahmen: Die App erkennt sie selbst und nimmt ein Standbild auf. Prüfe die
        Eckpunkte und ziehe sie bei Bedarf zurecht. Ändere dann das Licht, bis der Punkt im Messfeld
        neben dem Bild im umrahmten Normalbereich steht (Details beim Überfahren des Felds). Danach
        kannst du zum Livebild zurückkehren: Solange die Karten nicht bewegt werden, misst die App
        dort laufend mit denselben Eckpunkten.
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
          <MeasureField :exposure="exposure" />
        </template>
      </CardStage>
    </div>
  </section>
</template>
