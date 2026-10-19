<script setup lang="ts">
import { computed } from 'vue';

import type { StatusLevel } from './tab-status';

const props = defineProps<{ level: StatusLevel; fill: number }>();

const BARS = [0, 1, 2, 3] as const;

// Gefüllt: grün bei gutem Ergebnis, gelb bei einem Hinweis.
const filledClass = computed(() => (props.level === 'ok' ? 'bg-[#4f8f5b]' : 'bg-[#b8892f]'));
</script>

<template>
  <!-- Mini-Skala aus vier Strichen; der Text im Tab nennt das Ergebnis, die Skala zeigt es nur an. -->
  <span
    class="flex shrink-0 gap-0.5"
    aria-hidden="true"
    :data-level="level"
    data-testid="status-gauge"
  >
    <i
      v-for="bar in BARS"
      :key="bar"
      class="block h-3 w-[5px] rounded-[1px]"
      :class="bar < fill ? filledClass : 'bg-zinc-200'"
      :data-filled="bar < fill"
    ></i>
  </span>
</template>
