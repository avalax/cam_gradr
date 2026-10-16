<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue';

import { useCameraStore } from '../camera/camera-store';
import { drawFrame } from '../camera/draw-frame';
import type { Frame } from '../camera/frame';

import CameraControls from './CameraControls.vue';
import { attachStream, captureFromVideo } from './video-bindings';

// Höhe (in rem) von allem außer dem Bild: Seitenkopf, Knopfleiste und Abstände.
const CHROME_REM = 10;

const camera = useCameraStore();
const { stream, actual, status, still } = storeToRefs(camera);

const video = useTemplateRef<HTMLVideoElement>('video');
const canvas = useTemplateRef<HTMLCanvasElement>('canvas');
// Erst wenn das Video ein Bild liefert, ist eine Aufnahme sinnvoll.
const videoReady = ref(false);

// "Kamera an" gilt auch während des Startens oder bei einem Fehler, damit man die Optionen sieht.
const isOn = computed(() => status.value !== 'idle');
const isLive = computed(() => status.value === 'live');

function maxWidth(size: { width: number; height: number } | null): string {
  const aspect = size === null ? 16 / 9 : size.width / size.height;
  return `calc((100vh - ${String(CHROME_REM)}rem) * ${String(aspect)})`;
}

const liveWidth = computed(() => maxWidth(actual.value));
const stillWidth = computed(() => maxWidth(still.value));

function switchOn(): void {
  if (!isOn.value) {
    void camera.start();
  }
}

function switchOff(): void {
  camera.stop();
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

onMounted(() => {
  attachStream(video.value, stream.value);
  drawStill(still.value);
});

watch(stream, (next) => {
  videoReady.value = false;
  attachStream(video.value, next);
});

// Beim Umschalten tauschen Video und Canvas ihre Plätze im DOM; erst danach lässt sich anbinden.
watch(
  [still, isOn],
  () => {
    drawStill(still.value);
    attachStream(video.value, stream.value);
  },
  { flush: 'post' },
);
</script>

<template>
  <section class="lg:grid lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start lg:gap-6">
    <aside class="space-y-3 pb-4 lg:col-start-2 lg:row-start-1 lg:pb-0">
      <div role="group" aria-label="Kamera" class="inline-flex overflow-hidden rounded border">
        <button
          type="button"
          class="px-4 py-1 text-sm"
          :class="isOn ? 'bg-slate-800 text-white' : ''"
          :aria-pressed="isOn"
          @click="switchOn"
        >
          Kamera an
        </button>
        <button
          type="button"
          class="border-l px-4 py-1 text-sm"
          :class="isOn ? '' : 'bg-slate-800 text-white'"
          :aria-pressed="!isOn"
          @click="switchOff"
        >
          Kamera aus
        </button>
      </div>

      <CameraControls v-if="isOn" />
      <template v-else>
        <p class="text-sm text-slate-700" data-testid="camera-off-hint">
          Die Kamera ist aus. Hier siehst du das aufgenommene Standbild. Damit gehst du in den Tab
          „Graukarten“ oder „Farbkarten“. Für ein neues Standbild schaltest du die Kamera wieder
          ein.
        </p>
        <p v-if="still !== null" class="text-xs text-slate-600" data-testid="still-info">
          Standbild: {{ still.width }} × {{ still.height }}
        </p>
        <button
          v-if="still !== null"
          type="button"
          class="rounded border px-3 py-1 text-sm"
          @click="camera.clearStill()"
        >
          Standbild verwerfen
        </button>
      </template>
    </aside>

    <div class="min-w-0 space-y-3 lg:col-start-1 lg:row-start-1">
      <template v-if="isOn">
        <p v-if="!isLive || !videoReady" class="text-sm text-slate-600">
          Die Kamera startet, einen Moment bitte …
        </p>
        <video
          ref="video"
          class="w-full rounded bg-black"
          :style="{ maxWidth: liveWidth }"
          muted
          playsinline
          @loadeddata="videoReady = true"
        ></video>
        <div class="flex flex-wrap items-center gap-3">
          <button
            type="button"
            class="rounded bg-emerald-700 px-3 py-1 text-sm text-white disabled:opacity-50"
            :disabled="!isLive || !videoReady"
            @click="capture"
          >
            {{ still === null ? 'Standbild aufnehmen' : 'Neues Standbild aufnehmen' }}
          </button>
          <p v-if="still !== null" class="text-xs text-slate-600">
            Ein Standbild liegt bereit (Tabs „Graukarten“ und „Farbkarten“).
          </p>
        </div>
      </template>
      <template v-else>
        <canvas
          v-show="still !== null"
          ref="canvas"
          class="w-full rounded bg-black"
          :style="{ maxWidth: stillWidth }"
        ></canvas>
        <p v-if="still === null" class="text-sm text-slate-600">Noch kein Standbild aufgenommen.</p>
      </template>
    </div>
  </section>
</template>
