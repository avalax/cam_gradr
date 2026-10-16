<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef, watch } from 'vue';

import { useCameraStore } from '../camera/camera-store';
import { describeExposure } from '../chart/exposure';
import type { Verdict } from '../chart/exposure';
import { grayLayout, useChartStore } from '../chart/chart-store';

import { measureTick, MEASURE_INTERVAL_MS } from './gray-monitor';
import { buildShapes, clientToImage, instructionFor } from './overlay-geometry';
import { attachStream } from './video-bindings';

const emit = defineEmits<{ continue: [] }>();

const camera = useCameraStore();
const chart = useChartStore();
const { stream, actual, status } = storeToRefs(camera);
const { points, exposure, nextSlot, ready, corners } = storeToRefs(chart);

const video = useTemplateRef<HTMLVideoElement>('video');
const dragging = ref<{ card: number; index: number } | null>(null);

const size = computed(() => actual.value ?? { width: 1280, height: 720 });
const viewBox = computed(() => `0 0 ${String(size.value.width)} ${String(size.value.height)}`);
const shapes = computed(() => buildShapes(grayLayout, corners.value));
const handles = computed(() =>
  Object.entries(points.value).flatMap(([card, list]) =>
    list.map((point, index) => ({ card: Number(card), index, point })),
  ),
);
const instruction = computed(() => instructionFor(nextSlot.value));
const isLive = computed(() => status.value === 'live');

const BADGE: Readonly<Record<Verdict, string>> = {
  ok: 'bg-emerald-600',
  'too-dark': 'bg-blue-700',
  'too-bright': 'bg-orange-600',
  'high-contrast': 'bg-red-700',
};

function percent(value: number): string {
  return `${(value * 100).toFixed(0)} %`;
}

function imagePoint(event: PointerEvent | MouseEvent) {
  const rect = (event.currentTarget as SVGSVGElement).getBoundingClientRect();
  return clientToImage({ x: event.clientX, y: event.clientY }, rect, size.value);
}

function onClick(event: MouseEvent): void {
  chart.addCorner(imagePoint(event));
}

function onMove(event: PointerEvent): void {
  const active = dragging.value;
  if (active !== null) {
    chart.moveCorner(active.card, active.index, imagePoint(event));
  }
}

function endDrag(): void {
  dragging.value = null;
}

const timer = shallowRef<ReturnType<typeof setInterval>>();

onMounted(() => {
  attachStream(video.value, stream.value);
  timer.value = setInterval(() => {
    measureTick(ready.value && isLive.value, video.value, (grid) => {
      chart.measure(grid);
    });
  }, MEASURE_INTERVAL_MS);
});

onBeforeUnmount(() => {
  clearInterval(timer.value);
});

watch(stream, (next) => {
  attachStream(video.value, next);
});
</script>

<template>
  <section class="space-y-4">
    <p class="text-sm text-slate-700">
      Beide Graukarten gemeinsam vor die Kamera halten, dann die Eckpunkte der Karten markieren. Das
      Licht im Raum so einstellen, dass die Ampel grün wird.
    </p>

    <p v-if="!isLive" class="text-sm text-amber-800" role="alert">
      Die Kamera läuft nicht. Bitte zuerst im Schritt „Kamera“ starten.
    </p>

    <p class="text-sm font-medium" aria-live="polite">{{ instruction }}</p>

    <div class="relative max-w-3xl">
      <video ref="video" class="w-full rounded bg-black" muted playsinline></video>
      <!-- Die Eckpunkte werden per Zeiger gesetzt; reine Tastaturbedienung ist hier nicht sinnvoll. -->
      <!-- eslint-disable-next-line vuejs-accessibility/click-events-have-key-events, vuejs-accessibility/no-static-element-interactions -->
      <svg
        class="absolute inset-0 h-full w-full cursor-crosshair"
        :viewBox="viewBox"
        @click="onClick"
        @pointermove="onMove"
        @pointerup="endDrag"
        @pointerleave="endDrag"
      >
        <polygon
          v-for="shape in shapes"
          :key="shape.key"
          :points="shape.points"
          fill="none"
          :stroke="
            shape.kind === 'card' ? '#22d3ee' : shape.kind === 'large' ? '#facc15' : '#f472b6'
          "
          stroke-width="2"
        />
        <circle
          v-for="handle in handles"
          :key="`${String(handle.card)}-${String(handle.index)}`"
          :cx="handle.point.x"
          :cy="handle.point.y"
          r="8"
          fill="#22d3ee"
          stroke="#0f172a"
          stroke-width="2"
          class="cursor-move"
          @pointerdown.stop="dragging = { card: handle.card, index: handle.index }"
          @click.stop
        />
      </svg>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <span
        v-if="exposure !== null"
        class="rounded px-3 py-1 text-sm font-medium text-white"
        :class="BADGE[exposure.verdict]"
        data-testid="badge"
      >
        {{ describeExposure(exposure) }}
      </span>
      <span v-else class="text-sm text-slate-600">Noch keine Messung.</span>
      <button type="button" class="rounded border px-3 py-1 text-sm" @click="chart.reset()">
        Eckpunkte zurücksetzen
      </button>
      <button
        type="button"
        class="rounded bg-slate-800 px-3 py-1 text-sm text-white disabled:opacity-50"
        :disabled="exposure?.verdict !== 'ok'"
        @click="emit('continue')"
      >
        Weiter zu Schritt 2
      </button>
    </div>

    <dl v-if="exposure !== null" class="grid max-w-md grid-cols-2 gap-x-4 text-sm">
      <dt>18 %-Feld</dt>
      <dd>{{ percent(exposure.level18) }}</dd>
      <dt>50 %-Feld</dt>
      <dd>{{ percent(exposure.level50) }}</dd>
      <dt>Lichter</dt>
      <dd>{{ exposure.highlightsClipped ? 'geclippt' : 'ok' }}</dd>
      <dt>Schatten</dt>
      <dd>{{ exposure.shadowsCrushed ? 'abgesoffen' : 'ok' }}</dd>
    </dl>
  </section>
</template>
