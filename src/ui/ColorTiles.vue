<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import type { WedgeRow } from './gray-wedge';

const { t } = useI18n();
const props = defineProps<{ cards: readonly (readonly WedgeRow[])[] }>();

// Target only if there is a reference set.
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
  <!-- Each patch is split into strips: target, camera, corrected (the cards are stacked). -->
  <div
    class="flex size-full flex-col gap-1.5"
    role="img"
    :aria-label="t('wedge.tilesAria')"
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
