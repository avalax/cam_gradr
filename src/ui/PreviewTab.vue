<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { useCameraStore } from '../camera/camera-store';
import { useColorChartStore } from '../chart/chart-store';
import { NEUTRAL_IDS, colorLayout } from '../chart/layouts';
import { drawFrame } from '../camera/draw-frame';
import { createCpuRenderer } from '../gl/cpu-renderer';
import { createLutRenderer } from '../gl/lut-renderer';
import type { LutRenderer, RenderSource } from '../gl/lut-renderer';
import { startPreviewLoop } from '../gl/preview-loop';
import { buildLut } from '../lut/lut';
import { usePreviewStore } from '../lut/preview-store';
import { useReferenceStore } from '../reference/reference-store';
import { useSolveStore } from '../solve/solve-store';

import {
  brightnessText,
  colorCards,
  deviationSummary,
  oneDecimal,
  signedPoints,
  wedgeRows,
  worstPatches,
  zoneChanges,
} from './gray-wedge';
import ColorTiles from './ColorTiles.vue';
import CorrectionOptions from './CorrectionOptions.vue';
import { imageMaxWidth as maxWidthFor } from './image-size';
import GrayWedge from './GrayWedge.vue';
import { attachStream, captureFromVideo } from './video-bindings';
import WipeDivider from './WipeDivider.vue';

// LUT sample points in the preview; fine enough for smooth gradients, fast enough to compute.
const PREVIEW_LUT_SIZE = 33;
// At least one current video frame is available (HTMLMediaElement.HAVE_CURRENT_DATA).
const HAVE_CURRENT_DATA = 2;

const { t } = useI18n();
const camera = useCameraStore();
const solve = useSolveStore();
const preview = usePreviewStore();
const { stream, status, still } = storeToRefs(camera);
const { model, result } = storeToRefs(solve);
const { split } = storeToRefs(preview);
const { measurements } = storeToRefs(useColorChartStore());
const { selected } = storeToRefs(useReferenceStore());

// Side column view: colors first, switchable to the grayscale.
const viewOptions = computed(() => [
  { key: 'colors', label: t('preview.viewColors') } as const,
  { key: 'grays', label: t('preview.viewGrays') } as const,
]);
const view = ref<'colors' | 'grays'>('colors');
const WORST_COUNT = 3;

// Color grid from the measured chromatic patches and the patches with the largest residual error.
const tiles = computed(() =>
  colorCards(colorLayout, NEUTRAL_IDS, measurements.value, model.value, selected.value),
);
const worst = computed(() =>
  result.value === null ? [] : worstPatches(result.value.report, WORST_COUNT),
);

// Gray wedge from the measured neutral patches and what the correction changes per tonal range.
const rows = computed(() =>
  wedgeRows(NEUTRAL_IDS, measurements.value, model.value, selected.value),
);
const changes = computed(() => (model.value === null ? [] : zoneChanges(model.value)));
const emptyText = computed(() =>
  t(model.value === null ? 'preview.emptyNoModel' : 'preview.emptyNoCards'),
);
// Colors of the dots in front of the channels.
const CAST_COLORS = {
  red: '#b45353',
  green: '#4f8f5b',
  blue: '#4f6fb4',
} as const;

const video = useTemplateRef<HTMLVideoElement>('video');
const canvas = useTemplateRef<HTMLCanvasElement>('canvas');
const error = ref<string | null>(null);
// A capture only makes sense once the video delivers an image.
const videoReady = ref(false);

const isLive = computed(() => status.value === 'live');
const lut = computed(() => (model.value === null ? null : buildLut(model.value, PREVIEW_LUT_SIZE)));
// Without a still image of its own, the preview shows the image the colors were measured on (as long
// as the camera is off); a new capture or the live image replaces it.
const shownStill = computed(
  () => still.value ?? (isLive.value ? null : (camera.allStills().color ?? null)),
);
const hasSource = computed(() => isLive.value || shownStill.value !== null);
const aspect = ref(16 / 9);
const maxWidth = computed(() => maxWidthFor(aspect.value));

const renderer = shallowRef<LutRenderer | null>(null);
const stopLoop = shallowRef<(() => void) | null>(null);
// Still image as a canvas that can be loaded into the texture like a video.
const stillCanvas = document.createElement('canvas');

function drawStill(): void {
  const frame = shownStill.value;
  const context = stillCanvas.getContext('2d');
  if (frame !== null && context) {
    stillCanvas.width = frame.width;
    stillCanvas.height = frame.height;
    drawFrame(context, frame);
  }
}

// Chooses the image source: this tab's still image, otherwise the live image or the image of the color measurement.
function currentSource(): { image: RenderSource; width: number; height: number } | null {
  if (shownStill.value !== null && stillCanvas.width > 0) {
    return { image: stillCanvas, width: stillCanvas.width, height: stillCanvas.height };
  }
  const element = video.value;
  if (
    element !== null &&
    isLive.value &&
    element.readyState >= HAVE_CURRENT_DATA &&
    element.videoWidth > 0
  ) {
    return { image: element, width: element.videoWidth, height: element.videoHeight };
  }
  return null;
}

// After the capture the app turns the camera off (as after the automatic capture). A new
// camera start discards the still image and shows the live image again.
async function capture(): Promise<void> {
  await captureFromVideo(video.value, (grabber) => camera.captureStill(grabber));
  if (still.value !== null) {
    camera.stop();
  }
}

function sizeKey(size: { width: number; height: number }): string {
  return `${String(size.width)}x${String(size.height)}`;
}

function drawFrameToCanvas(): void {
  const target = canvas.value;
  const source = currentSource();
  if (target !== null && source !== null && renderer.value !== null) {
    const size = renderer.value.outputSize(source);
    if (sizeKey(target) !== sizeKey(size)) {
      target.width = size.width;
      target.height = size.height;
      aspect.value = source.width / source.height;
    }
    renderer.value.render(source.image, { split: split.value / 100 });
  }
}

function setup(): void {
  const target = canvas.value;
  /* v8 ignore next 3 -- the canvas exists as soon as the component is mounted */
  if (target === null) {
    return;
  }
  const gl = target.getContext('webgl2', { preserveDrawingBuffer: true });
  try {
    // Without WebGL2 the software rendering takes over so the preview still works.
    renderer.value = gl ? createLutRenderer(gl) : createCpuRenderer(target);
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
  videoReady.value = false;
  attachStream(video.value, next);
});
watch(shownStill, drawStill);
watch(lut, (next) => {
  if (next !== null) {
    renderer.value?.setLut(next);
  }
});

// The wipe over the image writes the divider position to the store.
// Mean error before and after the correction while the report is available.
const summary = computed(() =>
  result.value === null ? null : deviationSummary(result.value.report),
);

const splitModel = computed({
  get: () => split.value,
  set: (value: number) => {
    preview.setSplit(value);
  },
});
</script>

<template>
  <section class="lg:grid lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start lg:gap-6">
    <aside class="space-y-4 pb-4 lg:col-start-2 lg:row-start-1 lg:pb-0">
      <p class="text-sm text-slate-700">
        {{ t('preview.intro') }}
      </p>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded bg-emerald-700 px-3 py-1 text-sm text-white disabled:opacity-50"
          :disabled="!isLive || !videoReady"
          @click="capture"
        >
          {{ t('preview.capture') }}
        </button>
      </div>
      <CorrectionOptions />
      <p v-if="error !== null" class="text-sm text-red-700" role="alert">{{ error }}</p>
      <p
        v-if="renderer !== null"
        class="text-xs text-slate-600"
        data-testid="preview-renderer"
        :data-renderer="renderer.kind"
      >
        {{ t(renderer.kind === 'webgl2' ? 'preview.rendererWebgl' : 'preview.rendererCpu') }}
      </p>
    </aside>

    <div class="min-w-0 lg:col-start-1 lg:row-start-1">
      <!-- As in the card tabs: image on the left, a narrow column on the right; so the image is the same size everywhere. -->
      <div class="grid grid-cols-[minmax(0,1fr)_11rem] items-stretch gap-x-3">
        <div class="relative min-w-0 flex-1" :style="{ maxWidth: maxWidth }">
          <!-- The video only serves as an image source and stays invisible. -->
          <video
            ref="video"
            class="hidden"
            muted
            playsinline
            @loadeddata="videoReady = true"
          ></video>
          <!-- Placeholder the size of the image while there is nothing to show. -->
          <div
            v-if="model === null || !hasSource"
            class="flex w-full flex-col items-center justify-center gap-3 rounded border-2 border-dashed border-zinc-300 bg-zinc-100 p-6 text-center text-zinc-600"
            :style="{ aspectRatio: aspect }"
            data-testid="preview-placeholder"
          >
            <svg
              class="w-28 text-zinc-400"
              viewBox="0 0 96 60"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <rect x="2" y="2" width="92" height="56" rx="5" />
              <path
                d="M3 56 L3 3 H47 V56 Z"
                fill="currentColor"
                fill-opacity="0.25"
                stroke="none"
              />
              <path d="M48 2 V58" stroke-width="3" />
              <circle cx="48" cy="30" r="5" fill="currentColor" stroke="none" />
            </svg>
            <p
              v-if="model === null"
              class="max-w-xs text-sm leading-snug"
              data-testid="preview-no-model"
            >
              <span class="block font-semibold text-zinc-800">{{ t('preview.noModelTitle') }}</span>
              {{ t('preview.noModelText') }}
            </p>
            <p v-else class="max-w-xs text-sm leading-snug" data-testid="preview-no-source">
              <span class="block font-semibold text-zinc-800">{{
                t('preview.noSourceTitle')
              }}</span>
              {{ t('preview.noSourceText') }}
            </p>
          </div>
          <canvas
            v-show="model !== null && hasSource"
            ref="canvas"
            class="w-full rounded bg-black"
            data-testid="preview-canvas"
          ></canvas>
          <WipeDivider
            v-if="model !== null && hasSource"
            v-model="splitModel"
            :label="t('preview.divider')"
          />
        </div>

        <div
          class="flex w-44 shrink-0 flex-col overflow-hidden rounded-lg border border-zinc-500 bg-zinc-50 text-zinc-800"
          data-testid="preview-side"
        >
          <div
            class="flex gap-1 border-b-[3px] border-zinc-700 bg-zinc-200 p-1.5"
            role="group"
            :aria-label="t('preview.viewLabel')"
          >
            <button
              v-for="option in viewOptions"
              :key="option.key"
              type="button"
              class="flex-1 rounded border px-1 py-1 text-[11px] font-semibold"
              :class="
                view === option.key
                  ? 'border-zinc-800 bg-zinc-800 text-zinc-50'
                  : 'border-zinc-500 bg-zinc-50 text-zinc-800'
              "
              :aria-pressed="view === option.key"
              :data-testid="`view-${option.key}`"
              @click="view = option.key"
            >
              {{ option.label }}
            </button>
          </div>
          <div v-if="view === 'colors'" class="flex min-h-0 flex-1 flex-col gap-2 p-2">
            <div v-if="tiles.length > 0" class="min-h-24 flex-1">
              <ColorTiles :cards="tiles" />
            </div>
            <p
              v-else
              class="text-[11px] leading-snug text-zinc-600"
              data-testid="preview-side-empty"
            >
              {{ emptyText }}
            </p>
            <p v-if="tiles.length > 0" class="text-[10px] leading-snug text-zinc-500">
              {{ t('preview.tilesLegend') }}
            </p>
            <div
              v-if="worst.length > 0"
              class="text-[11px] leading-snug"
              data-testid="worst-patches"
            >
              <p class="font-semibold">{{ t('preview.worstTitle') }}</p>
              <p>
                <template v-for="(patch, index) in worst" :key="patch.id">
                  <template v-if="index > 0"> · </template>{{ patch.id }}
                  {{ oneDecimal(patch.deviation) }}
                </template>
              </p>
            </div>
          </div>
          <div v-else class="flex min-h-0 flex-1 flex-col gap-2 p-2">
            <div v-if="rows.length > 0" class="min-h-24 flex-1">
              <GrayWedge :rows="rows" />
            </div>
            <p
              v-else
              class="text-[11px] leading-snug text-zinc-600"
              data-testid="preview-side-empty"
            >
              {{ emptyText }}
            </p>
            <dl v-if="changes.length > 0" class="space-y-1.5" data-testid="zone-changes">
              <div v-for="zone in changes" :key="zone.name" class="text-[11px] leading-snug">
                <dt class="font-semibold">{{ zone.name }}</dt>
                <!-- Room for three lines, so the gray wedge keeps its size when the texts change. -->
                <dd class="min-h-[3lh]">
                  {{ brightnessText(zone.brighter) }}
                  <template v-if="zone.casts.length === 0">{{ t('preview.neutral') }}</template>
                  <template v-for="cast in zone.casts" :key="cast.key">
                    ·
                    <i
                      class="inline-block size-2 rounded-full"
                      :style="{ background: CAST_COLORS[cast.key] }"
                    ></i>
                    {{ cast.channel }} {{ signedPoints(cast.points) }}
                  </template>
                </dd>
              </div>
            </dl>
            <p v-if="changes.length > 0" class="text-[10px] leading-snug text-zinc-500">
              {{ t('preview.pointsLegend') }}
            </p>
          </div>
          <p
            v-if="summary !== null"
            class="border-t-[3px] border-zinc-700 bg-zinc-200 px-2 py-1.5 text-center text-[11px] font-semibold leading-tight"
            data-testid="preview-summary"
          >
            {{ summary }}
          </p>
        </div>

        <!-- Legend under the image: which side of the divider is the original and which the corrected image. -->
        <p
          v-if="model !== null && hasSource"
          class="col-start-1 row-start-2 mt-1.5 flex justify-between gap-3 text-xs text-zinc-700"
          data-testid="preview-legend"
        >
          <span class="flex items-center gap-1.5">
            <i class="size-2.5 rounded-full bg-zinc-400" aria-hidden="true"></i>
            <b class="font-semibold">{{ t('preview.legendOriginal') }}</b>
            {{ t('preview.legendOriginalHint') }}
          </span>
          <span class="flex items-center gap-1.5">
            <b class="font-semibold">{{ t('preview.legendCorrected') }}</b>
            {{ t('preview.legendCorrectedHint') }}
            <i class="size-2.5 rounded-full bg-emerald-700" aria-hidden="true"></i>
          </span>
        </p>
      </div>
    </div>
  </section>
</template>
