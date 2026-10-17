<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef, watch } from 'vue';

import { useCameraStore } from '../camera/camera-store';
import { drawFrame } from '../camera/draw-frame';
import { createLutRenderer } from '../gl/lut-renderer';
import type { LutRenderer } from '../gl/lut-renderer';
import { startPreviewLoop } from '../gl/preview-loop';
import { buildLut } from '../lut/lut';
import { usePreviewStore } from '../lut/preview-store';
import { useSolveStore } from '../solve/solve-store';

import { attachStream } from './video-bindings';

// Stützstellen der LUT in der Vorschau; fein genug für glatte Verläufe, schnell genug zu berechnen.
const PREVIEW_LUT_SIZE = 33;
// Höhe (in rem) von allem außer dem Bild: Seitenkopf und Abstände.
const CHROME_REM = 8;
// Mindestens ein aktuelles Videobild liegt vor (HTMLMediaElement.HAVE_CURRENT_DATA).
const HAVE_CURRENT_DATA = 2;

const camera = useCameraStore();
const solve = useSolveStore();
const preview = usePreviewStore();
const { stream, status, still } = storeToRefs(camera);
const { result } = storeToRefs(solve);
const { strength, split } = storeToRefs(preview);

const video = useTemplateRef<HTMLVideoElement>('video');
const canvas = useTemplateRef<HTMLCanvasElement>('canvas');
const error = ref<string | null>(null);

const isLive = computed(() => status.value === 'live');
const lut = computed(() =>
  result.value === null ? null : buildLut(result.value.model, PREVIEW_LUT_SIZE),
);
const hasSource = computed(() => isLive.value || still.value !== null);
const aspect = ref(16 / 9);
const maxWidth = computed(
  () => `calc((100vh - ${String(CHROME_REM)}rem) * ${String(aspect.value)})`,
);

const renderer = shallowRef<LutRenderer | null>(null);
const stopLoop = shallowRef<(() => void) | null>(null);
// Standbild als Zeichenfläche, die sich wie ein Video in die Textur laden lässt.
const stillCanvas = document.createElement('canvas');

function drawStill(): void {
  const frame = still.value;
  const context = stillCanvas.getContext('2d');
  if (frame !== null && context) {
    stillCanvas.width = frame.width;
    stillCanvas.height = frame.height;
    drawFrame(context, frame);
  }
}

// Wählt die Bildquelle: das Livebild, sonst das Standbild.
function currentSource(): { image: TexImageSource; width: number; height: number } | null {
  const element = video.value;
  if (
    element !== null &&
    isLive.value &&
    element.readyState >= HAVE_CURRENT_DATA &&
    element.videoWidth > 0
  ) {
    return { image: element, width: element.videoWidth, height: element.videoHeight };
  }
  if (!isLive.value && still.value !== null && stillCanvas.width > 0) {
    return { image: stillCanvas, width: stillCanvas.width, height: stillCanvas.height };
  }
  return null;
}

function sizeKey(size: { width: number; height: number }): string {
  return `${String(size.width)}x${String(size.height)}`;
}

function drawFrameToCanvas(): void {
  const target = canvas.value;
  const source = currentSource();
  if (target !== null && source !== null && renderer.value !== null) {
    if (sizeKey(target) !== sizeKey(source)) {
      target.width = source.width;
      target.height = source.height;
      aspect.value = source.width / source.height;
    }
    renderer.value.render(source.image, {
      strength: strength.value / 100,
      split: split.value / 100,
    });
  }
}

function setup(): void {
  const gl = canvas.value?.getContext('webgl2', { preserveDrawingBuffer: true });
  if (!gl) {
    error.value =
      'WebGL2 wird von diesem Browser nicht unterstützt, die Vorschau ist nicht möglich.';
    return;
  }
  try {
    renderer.value = createLutRenderer(gl);
  } catch (error_) {
    error.value = (error_ as Error).message;
    return;
  }
  if (lut.value !== null) {
    renderer.value.setLut(lut.value);
  }
  stopLoop.value = startPreviewLoop(drawFrameToCanvas);
}

onMounted(() => {
  attachStream(video.value, stream.value);
  drawStill();
  setup();
});

onBeforeUnmount(() => {
  stopLoop.value?.();
  renderer.value?.dispose();
});

watch(stream, (next) => {
  attachStream(video.value, next);
});
watch(still, drawStill);
watch(lut, (next) => {
  if (next !== null) {
    renderer.value?.setLut(next);
  }
});

function onStrength(event: Event): void {
  preview.setStrength(Number((event.target as HTMLInputElement).value));
}

function onSplit(event: Event): void {
  preview.setSplit(Number((event.target as HTMLInputElement).value));
}
</script>

<template>
  <section class="lg:grid lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start lg:gap-6">
    <aside class="space-y-4 pb-4 lg:col-start-2 lg:row-start-1 lg:pb-0">
      <p class="text-sm text-slate-700">
        Die Vorschau zeigt das Kamerabild mit der berechneten Farbkorrektur. Links der Trennlinie
        siehst du das Original, rechts das korrigierte Bild.
      </p>
      <p v-if="result === null" class="text-sm text-amber-800" data-testid="preview-no-model">
        Es gibt noch keine Farbkorrektur. Berechne sie zuerst im Tab „Farbkarten“.
      </p>
      <p v-else-if="!hasSource" class="text-sm text-amber-800" data-testid="preview-no-source">
        Schalte die Kamera im Tab „Kamera“ an oder nimm dort ein Standbild auf.
      </p>
      <p v-if="error !== null" class="text-sm text-red-700" role="alert">{{ error }}</p>

      <label class="flex flex-col gap-1 text-sm">
        <span>Stärke der Korrektur: {{ strength }} %</span>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          :value="strength"
          data-testid="strength"
          @input="onStrength"
        />
      </label>
      <label class="flex flex-col gap-1 text-sm">
        <span>Trennlinie: {{ split }} % (links Original)</span>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          :value="split"
          data-testid="split"
          @input="onSplit"
        />
      </label>
    </aside>

    <div class="min-w-0 lg:col-start-1 lg:row-start-1">
      <div class="relative w-full" :style="{ maxWidth: maxWidth }">
        <!-- Das Video dient nur als Bildquelle und bleibt unsichtbar. -->
        <video ref="video" class="hidden" muted playsinline></video>
        <canvas
          v-show="result !== null && hasSource"
          ref="canvas"
          class="w-full rounded bg-black"
          data-testid="preview-canvas"
        ></canvas>
        <div
          v-if="result !== null && hasSource"
          class="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow"
          :style="{ left: `${String(split)}%` }"
          data-testid="split-line"
        ></div>
      </div>
    </div>
  </section>
</template>
