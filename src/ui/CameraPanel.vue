<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onMounted, useTemplateRef, watch } from 'vue';

import { useCameraStore } from '../camera/camera-store';
import { drawFrame } from '../camera/draw-frame';
import { RESOLUTIONS } from '../camera/types';

import { attachStream, captureFromVideo } from './video-bindings';

const store = useCameraStore();
const { devices, selectedDeviceId, resolution, status, errorMessage, stream, actual, still } =
  storeToRefs(store);

const video = useTemplateRef<HTMLVideoElement>('video');
const canvas = useTemplateRef<HTMLCanvasElement>('canvas');

const isLive = computed(() => status.value === 'live');
const isStarting = computed(() => status.value === 'starting');
const resolutionKey = computed(
  () => `${String(resolution.value.width)}x${String(resolution.value.height)}`,
);

watch(stream, (next) => {
  attachStream(video.value, next);
});

watch(still, (frame) => {
  const element = canvas.value;
  const context = element?.getContext('2d');
  if (element !== null && frame !== null && context) {
    element.width = frame.width;
    element.height = frame.height;
    drawFrame(context, frame);
  }
});

function onDevice(event: Event): void {
  const value = (event.target as HTMLSelectElement).value;
  void store.selectDevice(value === '' ? null : value);
}

function onResolution(event: Event): void {
  const key = (event.target as HTMLSelectElement).value;
  const next = RESOLUTIONS.find((r) => `${String(r.width)}x${String(r.height)}` === key);
  if (next !== undefined) {
    void store.selectResolution(next);
  }
}

function capture(): void {
  captureFromVideo(video.value, (grabber) => store.captureStill(grabber));
}

onMounted(() => {
  attachStream(video.value, stream.value);
});
</script>

<template>
  <section class="space-y-4">
    <p class="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="note">
      Hinweis: Bitte Auto-Belichtung und Auto-Weißabgleich der Kamera in der Kamera-Software
      festsetzen. Automatische Anpassungen verfälschen die Messung.
    </p>

    <div class="flex flex-wrap items-end gap-4">
      <label class="flex flex-col text-sm">
        Kamera
        <select
          class="rounded border p-1"
          :value="selectedDeviceId ?? ''"
          :disabled="isStarting"
          @change="onDevice"
        >
          <option value="">Standardkamera</option>
          <option v-for="device in devices" :key="device.id" :value="device.id">
            {{ device.label }}
          </option>
        </select>
      </label>

      <label class="flex flex-col text-sm">
        Auflösung
        <select
          class="rounded border p-1"
          :value="resolutionKey"
          :disabled="isStarting"
          @change="onResolution"
        >
          <option
            v-for="r in RESOLUTIONS"
            :key="`${String(r.width)}x${String(r.height)}`"
            :value="`${String(r.width)}x${String(r.height)}`"
          >
            {{ r.width }} × {{ r.height }}
          </option>
        </select>
      </label>

      <button
        v-if="!isLive"
        type="button"
        class="rounded bg-slate-800 px-3 py-1 text-white disabled:opacity-50"
        :disabled="isStarting"
        @click="store.start()"
      >
        Kamera starten
      </button>
      <button v-else type="button" class="rounded border px-3 py-1" @click="store.stop()">
        Kamera stoppen
      </button>
      <button
        type="button"
        class="rounded bg-emerald-700 px-3 py-1 text-white disabled:opacity-50"
        :disabled="!isLive"
        @click="capture"
      >
        Standbild aufnehmen
      </button>
    </div>

    <p v-if="errorMessage !== null" class="text-sm text-red-700" role="alert">
      {{ errorMessage }}
    </p>
    <p v-if="actual !== null" class="text-xs text-slate-600">
      Aktive Auflösung: {{ actual.width }} × {{ actual.height }}
    </p>

    <div class="grid gap-4 md:grid-cols-2">
      <div>
        <h2 class="mb-1 text-sm font-medium">Live-Bild</h2>
        <video ref="video" class="w-full rounded bg-black" muted playsinline></video>
      </div>
      <div>
        <h2 class="mb-1 text-sm font-medium">Standbild</h2>
        <canvas v-show="still !== null" ref="canvas" class="w-full rounded bg-black"></canvas>
        <p v-if="still === null" class="text-sm text-slate-600">Noch kein Standbild aufgenommen.</p>
      </div>
    </div>
  </section>
</template>
