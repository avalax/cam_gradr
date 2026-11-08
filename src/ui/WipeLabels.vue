<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

// Position of the divider in percent: the header follows it, so the line and the two names sit
// exactly above the sides of the wipe.
// Without names the sides are camera and corrected; the preview names them after what it shows
// (for example the correction left and the look LUT right). With `switchable` each half is a button
// that switches what its side shows; `leftTip` and `rightTip` say what a click shows.
const props = defineProps<{
  split: number;
  leftLabel?: string;
  rightLabel?: string;
  leftCorrected?: boolean;
  rightCamera?: boolean;
  switchable?: boolean;
  leftTip?: string;
  rightTip?: string;
}>();
const emit = defineEmits<{ switch: [side: 'left' | 'right'] }>();

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
const leftName = computed(() => props.leftLabel ?? t('preview.labelCamera'));
const rightName = computed(() => props.rightLabel ?? t('preview.labelCorrected'));

const CAMERA_DOT = 'bg-zinc-400 dark:bg-zinc-500';
const CORRECTED_DOT = 'bg-emerald-700 dark:bg-emerald-400';
const HALF = 'flex min-w-0 items-center justify-center gap-1.5 overflow-hidden px-1 py-1.5';
// A switchable half looks like the label it is and only shows on hover or focus that it reacts.
const BUTTON = 'focus-ring-inset cursor-pointer hover:bg-zinc-300';

// Text for screen readers: what the side shows and what a click shows.
function described(name: string, tip: string | undefined): string {
  return tip === undefined ? name : `${name}. ${tip}`;
}
</script>

<template>
  <!-- Names the two sides of a wipe: camera on the left, corrected on the right (grey and green dot). -->
  <div
    class="relative grid border-b-(length:--band-line) border-zinc-700 bg-zinc-200 text-[11px] font-semibold leading-tight text-zinc-800"
    :style="{ gridTemplateColumns: `${String(split)}% minmax(0, 1fr)` }"
  >
    <component
      :is="switchable === true ? 'button' : 'span'"
      :type="switchable === true ? 'button' : undefined"
      :class="[HALF, { [BUTTON]: switchable === true }]"
      :title="switchable === true ? leftTip : undefined"
      :aria-label="switchable === true ? described(leftName, leftTip) : undefined"
      data-testid="labels-left"
      @click="switchable === true && emit('switch', 'left')"
    >
      <template v-if="left !== 'none'">
        <i
          class="size-2.5 shrink-0 rounded-full"
          :class="leftCorrected === true ? CORRECTED_DOT : CAMERA_DOT"
          aria-hidden="true"
        ></i>
        <template v-if="left === 'name'">{{ leftName }}</template>
      </template>
    </component>
    <component
      :is="switchable === true ? 'button' : 'span'"
      :type="switchable === true ? 'button' : undefined"
      :class="[HALF, { [BUTTON]: switchable === true }]"
      :title="switchable === true ? rightTip : undefined"
      :aria-label="switchable === true ? described(rightName, rightTip) : undefined"
      data-testid="labels-right"
      @click="switchable === true && emit('switch', 'right')"
    >
      <template v-if="right !== 'none'">
        <template v-if="right === 'name'">{{ rightName }}</template>
        <i
          class="size-2.5 shrink-0 rounded-full"
          :class="rightCamera === true ? CAMERA_DOT : CORRECTED_DOT"
          aria-hidden="true"
        ></i>
      </template>
    </component>
    <!-- The same line as the divider in the image, continued through the header. -->
    <i
      class="pointer-events-none absolute -bottom-[3px] top-0 w-[3px] -translate-x-1/2 bg-white shadow-[0_0_0_1px_#27272a]"
      :style="{ left: `${String(split)}%` }"
      aria-hidden="true"
      data-testid="labels-line"
    ></i>
  </div>
</template>
