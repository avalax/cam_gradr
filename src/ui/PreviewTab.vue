<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { useCameraStore } from '../camera/camera-store';
import { useColorChartStore } from '../chart/chart-store';
import { drawFrame } from '../camera/draw-frame';
import { createCpuRenderer } from '../gl/cpu-renderer';
import { createLutRenderer } from '../gl/lut-renderer';
import type { LutRenderer, RenderSource } from '../gl/lut-renderer';
import { startPreviewLoop } from '../gl/preview-loop';
import { formatDecimal } from '../lang/format';
import { applyLook, blendLuts } from '../look/look';
import { useLookStore } from '../look/look-store';
import { buildLut, identityLut } from '../lut/lut';
import { FULL_STRENGTH, usePreviewStore } from '../lut/preview-store';
import { useReferenceStore } from '../reference/reference-store';
import { useSolveStore } from '../solve/solve-store';

import {
  brightnessText,
  colorCards,
  deviationSummary,
  signedPoints,
  wedgeRows,
  worstPatches,
  zoneChanges,
} from './gray-wedge';
import ColorTiles from './ColorTiles.vue';
import { imageMaxWidth as maxWidthFor } from './image-size';
import ImageCornerButton from './ImageCornerButton.vue';
import GrayWedge from './GrayWedge.vue';
import { attachStream, captureFromVideo } from './video-bindings';
import LookBar from './LookBar.vue';
import WipeDivider from './WipeDivider.vue';
import WipeLabels from './WipeLabels.vue';

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
const { split, look: lookName, strength, left, right } = storeToRefs(preview);
const looks = useLookStore();
const { measurements } = storeToRefs(useColorChartStore());
const { selected } = storeToRefs(useReferenceStore());

// Side column view: colors first, switchable to the grayscale.
const viewOptions = computed(() => [
  { key: 'colors', label: t('preview.viewColors') } as const,
  { key: 'grays', label: t('preview.viewGrays') } as const,
]);
const view = ref<'colors' | 'grays'>('colors');
const WORST_COUNT = 3;

// The targets at the exposure of the shot, like in the report (without a report at the reference's).
const exposureGain = computed(() => result.value?.report.exposureGain ?? 1);

// Color grid from the measured chromatic patches and the patches with the largest residual error.
const tiles = computed(() =>
  colorCards(measurements.value, model.value, selected.value, exposureGain.value),
);
const worst = computed(() =>
  result.value === null ? [] : worstPatches(result.value.report, WORST_COUNT),
);

// Gray wedge from the measured neutral patches and what the correction changes per tonal range.
const rows = computed(() =>
  wedgeRows(measurements.value, model.value, selected.value, exposureGain.value),
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
const correctedLut = computed(() =>
  model.value === null ? null : buildLut(model.value, PREVIEW_LUT_SIZE),
);
const IDENTITY = identityLut(PREVIEW_LUT_SIZE);
const chosenLook = computed(() => (model.value === null ? null : looks.find(lookName.value)));
// With a look the right side lays it over the correction or, without correction, over the camera
// image (the identity).
const rightCamera = computed(() => chosenLook.value !== null && right.value === 'camera');
const rightBase = computed(() => (rightCamera.value ? IDENTITY : correctedLut.value));
// The chosen look LUT in full over its base. The strength only mixes the two, so that the slider
// follows without delay.
const fullLookLut = computed(() =>
  chosenLook.value === null || rightBase.value === null
    ? null
    : applyLook(rightBase.value, chosenLook.value),
);
const lut = computed(() =>
  rightBase.value === null || fullLookLut.value === null
    ? correctedLut.value
    : blendLuts(rightBase.value, fullLookLut.value, strength.value / FULL_STRENGTH),
);
// With a look the left side can show the correction instead of the camera image.
const leftCorrected = computed(() => chosenLook.value !== null && left.value === 'corrected');
const leftLut = computed(() => (leftCorrected.value ? correctedLut.value : null));
const leftLabel = computed(() =>
  t(leftCorrected.value ? 'preview.labelCorrected' : 'preview.labelCamera'),
);
const rightLabel = computed(() => {
  if (chosenLook.value === null) {
    return t('preview.labelCorrected');
  }
  return t(rightCamera.value ? 'preview.labelLookCamera' : 'preview.labelLook', {
    strength: strength.value,
  });
});
// A click on a label switches what its side starts from (only with a look).
const leftTip = computed(() =>
  t(leftCorrected.value ? 'preview.switchToCamera' : 'preview.switchToCorrected'),
);
const rightTip = computed(() =>
  t(rightCamera.value ? 'preview.switchLookCorrected' : 'preview.switchLookCamera'),
);

function switchSide(side: 'left' | 'right'): void {
  if (side === 'left') {
    preview.setLeft(leftCorrected.value ? 'camera' : 'corrected');
  } else {
    preview.setRight(rightCamera.value ? 'corrected' : 'camera');
  }
}
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
// The live image is drawn on every repaint, a still image only when it, the LUT or the divider
// has changed since: redrawn on every repaint, Firefox now and then showed it partly black.
let stillChanged = true;

function drawStill(): void {
  const frame = shownStill.value;
  const context = stillCanvas.getContext('2d');
  if (frame !== null && context) {
    stillCanvas.width = frame.width;
    stillCanvas.height = frame.height;
    drawFrame(context, frame);
  }
  stillChanged = true;
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
  const due = stillChanged || source?.image !== stillCanvas;
  if (due && target !== null && source !== null && renderer.value !== null) {
    const size = renderer.value.outputSize(source);
    if (sizeKey(target) !== sizeKey(size)) {
      target.width = size.width;
      target.height = size.height;
      aspect.value = source.width / source.height;
    }
    renderer.value.render(source.image, { split: split.value / 100 });
    stillChanged = false;
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
  renderer.value.setLeftLut(leftLut.value);
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
  stillChanged = true;
});
watch(leftLut, (next) => {
  renderer.value?.setLeftLut(next);
  stillChanged = true;
});
watch(split, () => {
  stillChanged = true;
});

// Mean error before and after the correction while the report is available.
const summary = computed(() =>
  result.value === null ? null : deviationSummary(result.value.report),
);

// The wipe over the image writes the divider position to the store.
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
      <p class="text-sm text-slate-700 dark:text-slate-300">
        {{ t('preview.intro') }}
      </p>
      <p v-if="error !== null" class="text-sm text-red-700 dark:text-red-400" role="alert">
        {{ error }}
      </p>
      <p
        v-if="renderer !== null"
        class="text-xs text-slate-600 dark:text-slate-400"
        data-testid="preview-renderer"
        :data-renderer="renderer.kind"
      >
        {{ t(renderer.kind === 'webgl2' ? 'preview.rendererWebgl' : 'preview.rendererCpu') }}
      </p>
    </aside>

    <div class="min-w-0 lg:col-start-1 lg:row-start-1">
      <!-- As in the card tabs: image on the left, a narrow column on the right; so the image is the same size everywhere. -->
      <div class="grid grid-cols-[minmax(0,1fr)_11rem] items-stretch gap-x-3">
        <!-- In the dark appearance the image lies on its own surface with an edge. -->
        <div
          data-testid="image-block"
          class="min-w-0 flex-1 dark:rounded-lg dark:border dark:border-zinc-400 dark:bg-zinc-100 dark:p-2.5"
          :style="{ maxWidth: maxWidth }"
        >
          <div class="relative">
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
                <span class="block font-semibold text-zinc-800">{{
                  t('preview.noModelTitle')
                }}</span>
                {{ t('preview.noModelText') }}
              </p>
              <p v-else class="max-w-xs text-sm leading-snug" data-testid="preview-no-source">
                <span class="block font-semibold text-zinc-800">{{
                  t('preview.noSourceTitle')
                }}</span>
                {{ t('preview.noSourceText') }}
              </p>
            </div>
            <!-- Names the two sides above the image, as above the color cards' wipe. -->
            <WipeLabels
              v-if="model !== null && hasSource"
              :split="splitModel"
              :left-label="leftLabel"
              :right-label="rightLabel"
              :left-corrected="leftCorrected"
              :right-camera="rightCamera"
              :switchable="chosenLook !== null"
              :left-tip="leftTip"
              :right-tip="rightTip"
              class="rounded-t"
              data-testid="preview-labels"
              @switch="switchSide"
            />
            <div class="relative">
              <canvas
                v-show="model !== null && hasSource"
                ref="canvas"
                class="w-full bg-black"
                data-testid="preview-canvas"
              ></canvas>
              <WipeDivider
                v-if="model !== null && hasSource"
                v-model="splitModel"
                :label="t('preview.divider', { left: leftLabel, right: rightLabel })"
                :left-name="leftLabel"
              />
              <!-- Takes a still image while the camera runs, where the card tabs have the trash. -->
              <ImageCornerButton
                v-if="model !== null && isLive"
                :label="t('preview.capture')"
                :title="t('preview.captureTitle')"
                :disabled="!videoReady"
                data-testid="preview-capture"
                @click="capture"
              >
                <path
                  d="M3 8a2 2 0 0 1 2-2h2.5l1.5-2h6l1.5 2H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
                />
                <path d="M15.5 13a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0z" />
              </ImageCornerButton>
            </div>
            <LookBar v-if="model !== null && hasSource" />
          </div>
        </div>

        <div
          class="flex w-44 shrink-0 flex-col overflow-hidden rounded-lg border border-zinc-500 bg-zinc-50 text-zinc-800"
          data-testid="preview-side"
        >
          <div
            class="flex gap-1 border-b-(length:--band-line) border-zinc-700 bg-zinc-200 p-1.5"
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
                  {{ formatDecimal(patch.deviation) }}
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
            class="border-t-(length:--band-line) border-zinc-700 bg-zinc-200 px-2 py-1.5 text-center text-[11px] font-semibold leading-tight"
            data-testid="preview-summary"
          >
            {{ summary }}
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
