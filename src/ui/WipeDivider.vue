<script setup lang="ts">
import { useTemplateRef } from 'vue';

defineProps<{ label: string }>();

// Position of the divider in percent of the width (the original is to its left).
const position = defineModel<number>({ required: true });

const FULL = 100;
const STEP = 1;
const BIG_STEP = 10;

const area = useTemplateRef<HTMLElement>('area');

function clamp(value: number): number {
  return Math.min(Math.max(value, 0), FULL);
}

function moveTo(event: PointerEvent): void {
  const rect = area.value?.getBoundingClientRect();
  if (rect !== undefined && rect.width > 0) {
    position.value = clamp(Math.round(((event.clientX - rect.left) / rect.width) * FULL));
  }
}

function onDown(event: PointerEvent): void {
  area.value?.setPointerCapture(event.pointerId);
  moveTo(event);
}

function onMove(event: PointerEvent): void {
  if (area.value?.hasPointerCapture(event.pointerId) === true) {
    moveTo(event);
  }
}

// Arrow keys move the divider (larger steps with Shift), Home/End jump to the edge.
function onKey(event: KeyboardEvent): void {
  const step = event.shiftKey ? BIG_STEP : STEP;
  const target: Record<string, number> = {
    ArrowLeft: position.value - step,
    ArrowDown: position.value - step,
    ArrowRight: position.value + step,
    ArrowUp: position.value + step,
    Home: 0,
    End: FULL,
  };
  const next = target[event.key];
  if (next !== undefined) {
    event.preventDefault();
    position.value = clamp(next);
  }
}
</script>

<template>
  <!-- Wipe: the divider can be dragged or moved by keyboard; the original is to its left. -->
  <div
    ref="area"
    class="absolute inset-0 cursor-ew-resize touch-none select-none outline-offset-2 focus-visible:outline"
    tabindex="0"
    role="slider"
    aria-orientation="horizontal"
    :aria-label="label"
    aria-valuemin="0"
    :aria-valuemax="FULL"
    :aria-valuenow="position"
    :aria-valuetext="`${String(position)} % Original`"
    data-testid="wipe"
    @pointerdown="onDown"
    @pointermove="onMove"
    @keydown="onKey"
  >
    <div
      class="pointer-events-none absolute inset-y-0 w-[3px] -translate-x-1/2 bg-zinc-50 shadow-[0_0_0_1px_#27272a]"
      :style="{ left: `${String(position)}%` }"
      data-testid="wipe-line"
    ></div>
    <div
      class="pointer-events-none absolute top-1/2 h-8 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-zinc-800 bg-zinc-50 shadow"
      :style="{ left: `${String(position)}%` }"
      data-testid="wipe-grip"
    ></div>
  </div>
</template>
