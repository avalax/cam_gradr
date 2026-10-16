<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef, watch } from 'vue';

import { useCameraStore } from '../camera/camera-store';
import { drawFrame } from '../camera/draw-frame';
import type { Frame } from '../camera/frame';
import { describeExposure } from '../chart/exposure';
import type { Verdict } from '../chart/exposure';
import { grayLayout, useChartStore } from '../chart/chart-store';

import CameraControls from './CameraControls.vue';
import { frameGrid, measureTick, MEASURE_INTERVAL_MS } from './gray-monitor';
import { buildShapes, clientToImage, instructionFor } from './overlay-geometry';
import { attachStream, captureFromVideo } from './video-bindings';

const emit = defineEmits<{ continue: [] }>();

const camera = useCameraStore();
const chart = useChartStore();
const { stream, actual, status, still } = storeToRefs(camera);
const { points, exposure, nextSlot, ready, corners } = storeToRefs(chart);

const video = useTemplateRef<HTMLVideoElement>('video');
const canvas = useTemplateRef<HTMLCanvasElement>('canvas');
const dragging = ref<{ card: number; index: number } | null>(null);

const isLive = computed(() => status.value === 'live');
const showStill = computed(() => still.value !== null);
const size = computed(() => still.value ?? actual.value ?? { width: 1280, height: 720 });
const viewBox = computed(() => `0 0 ${String(size.value.width)} ${String(size.value.height)}`);
const shapes = computed(() => buildShapes(grayLayout, corners.value));
const handles = computed(() =>
  showStill.value
    ? Object.entries(points.value).flatMap(([card, list]) =>
        list.map((point, index) => ({ card: Number(card), index, point })),
      )
    : [],
);
const instruction = computed(() =>
  showStill.value
    ? instructionFor(nextSlot.value)
    : 'Beide Graukarten ruhig vor die Kamera halten und ein Standbild aufnehmen. Die Eckpunkte werden danach auf dem Standbild gesetzt.',
);

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
  if (showStill.value) {
    chart.addCorner(imagePoint(event));
  }
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

function capture(): void {
  captureFromVideo(video.value, (grabber) => camera.captureStill(grabber));
}

function drawStill(frame: Frame | null): void {
  const element = canvas.value;
  const context = element?.getContext('2d');
  if (element !== null && frame !== null && context) {
    element.width = frame.width;
    element.height = frame.height;
    drawFrame(context, frame);
  }
}

const timer = shallowRef<ReturnType<typeof setInterval>>();

onMounted(() => {
  attachStream(video.value, stream.value);
  drawStill(still.value);
  timer.value = setInterval(() => {
    measureTick(ready.value && isLive.value && !showStill.value, video.value, (grid) => {
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

watch(still, drawStill);

// Auf dem Standbild wird bei jeder Änderung (neues Bild, verschobene Eckpunkte) neu gemessen.
watch([still, points], () => {
  const frame = still.value;
  if (frame !== null) {
    chart.measure(frameGrid(frame));
  }
});

// Eckpunkte gelten nur für eine Bildgröße; bei anderer Auflösung neu beginnen.
watch(actual, (next, previous) => {
  if (
    next !== null &&
    previous !== null &&
    (next.width !== previous.width || next.height !== previous.height)
  ) {
    chart.reset();
  }
});
</script>

<template>
  <section class="space-y-4">
    <CameraControls />

    <p class="text-sm text-slate-700">
      Schritt 1 stellt die Raumhelligkeit ein. Nimm ein Standbild der beiden Graukarten auf,
      markiere darauf die Eckpunkte und ändere dann das Licht, bis die Ampel grün wird. Danach
      kannst du zum Livebild zurückkehren: Solange die Karten nicht bewegt werden, misst die App
      dort laufend mit denselben Eckpunkten.
    </p>

    <p v-if="!isLive" class="text-sm text-amber-800">Bitte zuerst die Kamera starten.</p>

    <p class="text-sm font-medium" aria-live="polite">{{ instruction }}</p>

    <div class="relative max-w-3xl">
      <video
        v-show="!showStill"
        ref="video"
        class="w-full rounded bg-black"
        muted
        playsinline
      ></video>
      <canvas v-show="showStill" ref="canvas" class="w-full rounded bg-black"></canvas>
      <!-- Die Eckpunkte werden per Zeiger gesetzt; reine Tastaturbedienung ist hier nicht sinnvoll. -->
      <!-- eslint-disable-next-line vuejs-accessibility/click-events-have-key-events, vuejs-accessibility/no-static-element-interactions -->
      <svg
        class="absolute inset-0 h-full w-full touch-none"
        :class="showStill ? 'cursor-crosshair' : ''"
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

    <p v-if="camera.errorMessage !== null && isLive" class="text-sm text-red-700" role="alert">
      {{ camera.errorMessage }}
    </p>

    <div class="flex flex-wrap items-center gap-3">
      <button
        type="button"
        class="rounded bg-emerald-700 px-3 py-1 text-sm text-white disabled:opacity-50"
        :disabled="!isLive"
        @click="capture"
      >
        {{ showStill ? 'Neues Standbild aufnehmen' : 'Standbild aufnehmen' }}
      </button>
      <button
        v-if="showStill"
        type="button"
        class="rounded border px-3 py-1 text-sm"
        @click="camera.clearStill()"
      >
        Zurück zum Livebild
      </button>
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
