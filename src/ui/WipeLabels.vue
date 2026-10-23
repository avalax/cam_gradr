<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

// Position of the divider in percent: the header follows it, so the line and the two names sit
// exactly above the sides of the wipe.
const props = defineProps<{ split: number }>();

// From this share of the width on a side shows its dot, from the next one also its name.
const MIN_DOT = 8;
const MIN_NAME = 24;
const FULL = 100;

function mode(share: number): 'none' | 'dot' | 'name' {
  if (share < MIN_DOT) {
    return 'none';
  }
  return share < MIN_NAME ? 'dot' : 'name';
}

const left = computed(() => mode(props.split));
const right = computed(() => mode(FULL - props.split));
</script>

<template>
  <!-- Names the two sides of a wipe: camera on the left, corrected on the right (grey and green dot). -->
  <div
    class="relative grid border-b-[3px] border-zinc-700 bg-zinc-200 text-[11px] font-semibold leading-tight text-zinc-800"
    :style="{ gridTemplateColumns: `${String(split)}% minmax(0, 1fr)` }"
  >
    <span class="flex min-w-0 items-center justify-center gap-1.5 overflow-hidden px-1 py-1.5">
      <template v-if="left !== 'none'">
        <i class="size-2.5 shrink-0 rounded-full bg-zinc-400" aria-hidden="true"></i>
        <template v-if="left === 'name'">{{ t('preview.labelCamera') }}</template>
      </template>
    </span>
    <span class="flex min-w-0 items-center justify-center gap-1.5 overflow-hidden px-1 py-1.5">
      <template v-if="right !== 'none'">
        <template v-if="right === 'name'">{{ t('preview.labelCorrected') }}</template>
        <i class="size-2.5 shrink-0 rounded-full bg-emerald-700" aria-hidden="true"></i>
      </template>
    </span>
    <!-- The same line as the divider in the image, continued through the header. -->
    <i
      class="pointer-events-none absolute -bottom-[3px] top-0 w-[3px] -translate-x-1/2 bg-zinc-50 shadow-[0_0_0_1px_#27272a]"
      :style="{ left: `${String(split)}%` }"
      aria-hidden="true"
      data-testid="labels-line"
    ></i>
  </div>
</template>
