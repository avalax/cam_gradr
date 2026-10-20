<script setup lang="ts">
import { computed } from 'vue';

import type { ColorModel } from '../solve/fit';

import { lutSlices } from './lut-slices';

const props = defineProps<{ model: ColorModel | null }>();

const CELLS = 8;
const EMPTY = [0, 1, 2, 3] as const;
const slices = computed(() => (props.model === null ? null : lutSlices(props.model, CELLS)));
</script>

<template>
  <!-- Four slices through the LUT; without color correction, gray patches stand in. -->
  <div
    class="grid grid-cols-[repeat(4,minmax(0,5rem))] gap-2"
    data-testid="lut-slices"
    :data-ready="slices !== null"
  >
    <template v-if="slices !== null">
      <div
        v-for="(colors, index) in slices"
        :key="index"
        class="grid aspect-square grid-cols-8 overflow-hidden rounded-md border border-zinc-300"
        data-testid="lut-slice"
      >
        <i
          v-for="(color, cell) in colors"
          :key="cell"
          class="block"
          :style="{ background: color }"
        ></i>
      </div>
    </template>
    <template v-else>
      <div
        v-for="index in EMPTY"
        :key="index"
        class="aspect-square rounded-md border border-zinc-300 bg-zinc-200"
        data-testid="lut-slice-empty"
      ></div>
    </template>
  </div>
</template>
