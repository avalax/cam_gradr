<script setup lang="ts">
import { computed } from 'vue';

import type { ColorModel } from '../solve/fit';

import { lutSlices } from './lut-slices';
import type { SliceLook } from './lut-slices';

const props = defineProps<{ model: ColorModel | null; look?: SliceLook | null }>();

const CELLS = 8;
const EMPTY = [0, 1, 2, 3, 4, 5, 6, 7] as const;
const slices = computed(() =>
  props.model === null ? null : lutSlices(props.model, CELLS, props.look ?? null),
);
</script>

<template>
  <!-- Eight slices through the LUT, in two rows where the box has room for them, otherwise every
       second one in one row (see the variants in style.css); without color correction, gray patches
       stand in. The width comes from the caller, the slices are square. -->
  <div class="grid grid-cols-4 gap-2" data-testid="lut-slices" :data-ready="slices !== null">
    <template v-if="slices !== null">
      <div
        v-for="(colors, index) in slices"
        :key="index"
        class="grid aspect-square grid-cols-8 overflow-hidden rounded-md border border-zinc-300 one-row:odd:hidden"
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
        class="aspect-square rounded-md border border-zinc-300 bg-zinc-200 one-row:odd:hidden"
        data-testid="lut-slice-empty"
      ></div>
    </template>
  </div>
</template>
