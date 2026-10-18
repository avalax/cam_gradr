<script setup lang="ts">
import { computed } from 'vue';

import type { WedgeRow } from './gray-wedge';

const props = defineProps<{ cards: readonly (readonly WedgeRow[])[] }>();

// Soll nur, wenn es einen Referenzsatz gibt.
const hasTarget = computed(() =>
  props.cards.some((card) => card.some((row) => row.target !== null)),
);
const stripes = computed(() =>
  hasTarget.value
    ? (['target', 'camera', 'corrected'] as const)
    : (['camera', 'corrected'] as const),
);
</script>

<template>
  <!-- Jedes Feld ist in Streifen geteilt: Soll, Kamera, korrigiert (die Karten stehen untereinander). -->
  <div
    class="flex size-full flex-col gap-1.5"
    role="img"
    aria-label="Farbfelder: Soll, Kamera und nach der Korrektur"
    data-testid="color-tiles"
  >
    <div
      v-for="(card, index) in cards"
      :key="index"
      class="grid min-h-0 flex-1 grid-cols-3 gap-0.5"
    >
      <div
        v-for="row in card"
        :key="row.id"
        class="flex min-h-0 overflow-hidden rounded-[1px]"
        :title="row.id"
        :data-patch="row.id"
      >
        <i
          v-for="stripe in stripes"
          :key="stripe"
          class="block min-w-0 flex-1"
          :style="{ background: row[stripe] ?? undefined }"
          :data-stripe="stripe"
        ></i>
      </div>
    </div>
  </div>
</template>
