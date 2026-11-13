<script setup lang="ts">
import { computed } from 'vue';

import type { StatusLevel } from './tab-status';

const props = defineProps<{ level: StatusLevel; fill: number }>();

const BARS = [0, 1, 2, 3] as const;

// Filled: green for a good result, yellow for a hint, red for a problem. The yellow stands apart
// from the green also for red-green color blindness; the number of bars says the same in addition.
const FILLED: Readonly<Record<StatusLevel, string>> = {
  off: 'bg-zinc-200',
  bad: 'bg-[#b2402f]',
  warn: 'bg-[#c9962a]',
  ok: 'bg-[#4f8f5b]',
};
const filledClass = computed(() => FILLED[props.level]);
</script>

<template>
  <!-- Mini scale of four bars; the text in the tab states the result, the scale only displays it. -->
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
