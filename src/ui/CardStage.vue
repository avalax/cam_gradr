<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef, watch } from 'vue';

import { useCameraStore } from '../camera/camera-store';
import { drawFrame } from '../camera/draw-frame';
import type { Frame } from '../camera/frame';
import type { ChartStore } from '../chart/chart-store';
import type { ChartLayout } from '../chart/types';

import { frameGrid, measureTick, MEASURE_INTERVAL_MS } from './gray-monitor';
import { buildShapes, clientToImage, instructionFor } from './overlay-geometry';
import { attachStream, captureFromVideo } from './video-bindings';

const props = defineProps<{
  store: ChartStore;
  layout: ChartLayout;
  // Namen der Karten für die Klickanweisung, z. B. { 3: 'linke Graukarte (50 %)' }.
  cardNames: Readonly<Record<number, string>>;
  // Hinweis, solange noch kein Standbild aufgenommen ist.
  idleText: string;
  // Misst im Livebild laufend mit den gesetzten Eckpunkten (nur für die Helligkeitseinstellung).
  liveMeasure: boolean;
}>();

const camera = useCameraStore();
const { stream, actual, status, still } = storeToRefs(camera);
const { points, nextSlot, ready, corners } = storeToRefs(props.store);

const video = useTemplateRef<HTMLVideoElement>('video');
const canvas = useTemplateRef<HTMLCanvasElement>('canvas');
const dragging = ref<{ card: number; index: number } | null>(null);
// Erst wenn das Video ein Bild liefert, ist eine Aufnahme sinnvoll.
const videoReady = ref(false);

const isLive = computed(() => status.value === 'live');
const showStill = computed(() => still.value !== null);
const size = computed(() => still.value ?? actual.value ?? { width: 1280, height: 720 });
const viewBox = computed(() => `0 0 ${String(size.value.width)} ${String(size.value.height)}`);
const shapes = computed(() => buildShapes(props.layout, corners.value));
const handles = computed(() =>
  showStill.value
    ? Object.entries(points.value).flatMap(([card, list]) =>
        list.map((point, index) => ({ card: Number(card), index, point })),
      )
    : [],
);
const instruction = computed(() =>
  showStill.value ? instructionFor(nextSlot.value, props.cardNames) : props.idleText,
);

function imagePoint(event: PointerEvent | MouseEvent) {
  const rect = (event.currentTarget as SVGSVGElement).getBoundingClientRect();
  return clientToImage({ x: event.clientX, y: event.clientY }, rect, size.value);
}

function onClick(event: MouseEvent): void {
  if (showStill.value) {
    props.store.addCorner(imagePoint(event));
  }
}

function onMove(event: PointerEvent): void {
  const active = dragging.value;
  if (active !== null) {
    props.store.moveCorner(active.card, active.index, imagePoint(event));
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
    const active = props.liveMeasure && ready.value && isLive.value && !showStill.value;
    measureTick(active, video.value, (grid) => {
      props.store.measure(grid);
    });
  }, MEASURE_INTERVAL_MS);
});

onBeforeUnmount(() => {
  clearInterval(timer.value);
});

watch(stream, (next) => {
  videoReady.value = false;
  attachStream(video.value, next);
});

watch(still, drawStill);

// Auf dem Standbild wird bei jeder Änderung (neues Bild, verschobene Eckpunkte) neu gemessen.
watch([still, points], () => {
  const frame = still.value;
  if (frame !== null) {
    props.store.measure(frameGrid(frame));
  }
});

// Eckpunkte gelten nur für eine Bildgröße; bei anderer Auflösung neu beginnen.
watch(actual, (next, previous) => {
  if (
    next !== null &&
    previous !== null &&
    (next.width !== previous.width || next.height !== previous.height)
  ) {
    props.store.reset();
  }
});
</script>

<template>
  <div class="space-y-4">
    <p v-if="!isLive" class="text-sm text-amber-800">Bitte zuerst die Kamera starten.</p>
    <p v-else-if="!videoReady" class="text-sm text-slate-600">
      Die Kamera startet, einen Moment bitte …
    </p>

    <p class="text-sm font-medium" aria-live="polite">{{ instruction }}</p>

    <div class="flex items-stretch gap-3">
      <div class="relative min-w-0 flex-1">
        <video
          v-show="!showStill"
          ref="video"
          class="w-full rounded bg-black"
          muted
          playsinline
          @loadeddata="videoReady = true"
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
            :data-shape="shape.key"
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
          <text
            v-for="handle in handles"
            :key="`label-${String(handle.card)}-${String(handle.index)}`"
            :x="handle.point.x + 12"
            :y="handle.point.y - 12"
            fill="#ffffff"
            stroke="#0f172a"
            stroke-width="4"
            paint-order="stroke"
            font-size="22"
            font-weight="bold"
            pointer-events="none"
            data-testid="corner-label"
          >
            {{ handle.index + 1 }}
          </text>
        </svg>
      </div>
      <slot name="side" />
    </div>

    <p v-if="camera.errorMessage !== null && isLive" class="text-sm text-red-700" role="alert">
      {{ camera.errorMessage }}
    </p>

    <div class="flex flex-wrap items-center gap-3">
      <button
        type="button"
        class="rounded bg-emerald-700 px-3 py-1 text-sm text-white disabled:opacity-50"
        :disabled="!isLive || !videoReady"
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
      <button type="button" class="rounded border px-3 py-1 text-sm" @click="store.reset()">
        Eckpunkte zurücksetzen
      </button>
      <slot name="actions" />
    </div>
  </div>
</template>
