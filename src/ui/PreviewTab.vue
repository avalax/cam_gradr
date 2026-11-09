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
import ChoiceChips from './ChoiceChips.vue';
import ColorTiles from './ColorTiles.vue';
import { CAMERA_SWITCH_ID, focusById } from './focus';
import {
  IMAGE_BAND,
  IMAGE_BLOCK,
  IMAGE_ROW,
  TAB_COLUMNS,
  imageWidth as widthFor,
  previewImage,
} from './image-size';
import ImageCornerButton from './ImageCornerButton.vue';
import ImageMessages from './ImageMessages.vue';
import GrayWedge from './GrayWedge.vue';
import { previewSides } from './preview-sides';
import StageLabel from './StageLabel.vue';
import { stageState } from './stage-state';
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
const { stream, status, still, actual } = storeToRefs(camera);
const { model, result, referenceName } = storeToRefs(solve);
const { split, look: lookName, strength, left, right } = storeToRefs(preview);
const looks = useLookStore();
const { measurements } = storeToRefs(useColorChartStore());
const { selected } = storeToRefs(useReferenceStore());

// Side column view: colors first, switchable to the grayscale.
type View = 'colors' | 'grays';
const viewOptions = computed(() => [
  { key: 'colors', value: 'colors' as const, label: t('preview.viewColors') },
  { key: 'grays', value: 'grays' as const, label: t('preview.viewGrays') },
]);
const view = ref<View>('colors');

// The targets at the exposure of the shot, like in the report (without a report at the reference's).
const exposureGain = computed(() => result.value?.report.exposureGain ?? 1);
// The targets come from the set the correction was fitted with; while that set is missing (a
// correction loaded from a project) the tiles and the wedge show no targets rather than another
// set's.
const fittedReference = computed(() =>
  selected.value?.name === referenceName.value ? selected.value : null,
);

// Color grid from the measured chromatic patches and the patches with the largest residual error.
const tiles = computed(() =>
  colorCards(measurements.value, model.value, fittedReference.value, exposureGain.value),
);
const worst = computed(() => (result.value === null ? [] : worstPatches(result.value.report)));

// Gray wedge from the measured neutral patches and what the correction changes per tonal range.
const rows = computed(() =>
  wedgeRows(measurements.value, model.value, fittedReference.value, exposureGain.value),
);
const changes = computed(() => (model.value === null ? [] : zoneChanges(model.value)));
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
// What the sides show and how they are named, with the same names as the hint of the tab.
const sides = computed(() => previewSides(chosenLook.value !== null, left.value, right.value));
// With a look the right side lays it over the correction or, without correction, over the camera
// image (the identity).
const rightCamera = computed(() => sides.value.rightCamera);
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
const leftCorrected = computed(() => sides.value.leftCorrected);
const leftLut = computed(() => (leftCorrected.value ? correctedLut.value : null));
const leftLabel = computed(() => sides.value.leftName);
// The label of the look's side adds its strength.
const rightLabel = computed(() =>
  chosenLook.value === null
    ? sides.value.rightName
    : t('preview.labelStrength', { name: sides.value.rightName, strength: strength.value }),
);
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
// What the preview shows, as in the band of the card tabs: a badge on the image while there is one,
// otherwise the band above the placeholder. Without a correction the camera shows nothing here, so
// the band names what is missing instead of a live image it does not show.
const stage = computed(() => stageState(shownStill.value !== null, isLive.value));
const band = computed(() =>
  model.value === null
    ? { state: 'off' as const, label: t('preview.noModelTitle') }
    : { state: stage.value, label: null },
);
// Whether there is an image, and its aspect ratio: one rule with the export, whose invisible copy
// of this image area must not differ from it.
const area = computed(() =>
  previewImage({
    corrected: model.value !== null,
    live: isLive.value,
    stills: camera.allStills(),
    actual: actual.value,
  }),
);
const showImage = computed(() => area.value.shown);
const aspect = computed(() => area.value.aspect);
const width = computed(() => widthFor(aspect.value));

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
// camera start discards the still image and shows the live image again. The button leaves with the
// live image, so the focus goes to the camera switch.
async function capture(): Promise<void> {
  await captureFromVideo(video.value, (grabber) => camera.captureStill(grabber));
  if (still.value !== null) {
    camera.stop();
    focusById(CAMERA_SWITCH_ID);
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

// Mean error before and after the correction while the report is available; a correction without a
// report (loaded from a project whose reference set is missing) says so, as under the color cards'
// divider.
const summary = computed(() => {
  if (result.value !== null) {
    return deviationSummary(result.value.report);
  }
  return model.value === null ? null : t('color.wipe.noReport');
});

// The wipe over the image writes the divider position to the store.
const splitModel = computed({
  get: () => split.value,
  set: (value: number) => {
    preview.setSplit(value);
  },
});
</script>

<template>
  <section :class="TAB_COLUMNS">
    <aside class="space-y-3 pb-4 lg:col-start-2 lg:row-start-1 lg:pb-0">
      <p class="text-sm text-zinc-700">
        {{ t('preview.intro') }}
      </p>
      <p v-if="error !== null" class="text-sm text-red-700 dark:text-red-400" role="alert">
        {{ error }}
      </p>
      <p
        v-if="renderer !== null"
        class="text-xs text-zinc-600"
        data-testid="preview-renderer"
        :data-renderer="renderer.kind"
      >
        {{ t(renderer.kind === 'webgl2' ? 'preview.rendererWebgl' : 'preview.rendererCpu') }}
      </p>
    </aside>

    <div class="min-w-0 lg:col-start-1 lg:row-start-1">
      <!-- As in the card tabs: image on the left, a narrow column on the right; so the image is the same size everywhere. -->
      <div :class="IMAGE_ROW">
        <div data-testid="image-block" :class="IMAGE_BLOCK" :style="{ width }">
          <div class="relative">
            <!-- The video only serves as an image source and stays invisible. -->
            <video
              ref="video"
              class="hidden"
              muted
              playsinline
              @loadeddata="videoReady = true"
            ></video>
            <!-- The band above the image names the two sides, as above the color cards' wipe; without
                 an image it says what the camera does, as on the card tabs, or that the correction is
                 missing. -->
            <WipeLabels
              v-if="showImage"
              :split="splitModel"
              :left-label="leftLabel"
              :right-label="rightLabel"
              :left-corrected="leftCorrected"
              :right-camera="rightCamera"
              :switchable="chosenLook !== null"
              :left-tip="leftTip"
              :right-tip="rightTip"
              :class="IMAGE_BAND"
              data-testid="preview-labels"
              @switch="switchSide"
            />
            <StageLabel
              v-else
              :state="band.state"
              :label="band.label"
              :class="IMAGE_BAND"
              data-testid="stage-label"
            />
            <div class="relative">
              <!-- Placeholder the size of the image while there is nothing to show. -->
              <div
                v-if="!showImage"
                class="flex w-full flex-col items-center justify-center gap-3 rounded-b border-2 border-t-0 border-dashed border-zinc-300 bg-zinc-100 p-6 text-center text-zinc-600"
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
                  <!-- The grip of the divider as a path: the tests count the corner points as circles. -->
                  <path
                    d="M43 30a5 5 0 1 0 10 0a5 5 0 1 0-10 0z"
                    fill="currentColor"
                    stroke="none"
                  />
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
                  {{ t('preview.noSourceText', { button: t('camera.toggle.start') }) }}
                </p>
              </div>
              <canvas
                v-show="showImage"
                ref="canvas"
                class="w-full bg-black"
                data-testid="preview-canvas"
              ></canvas>
              <!-- Live image or still image, as in the band of the card tabs. -->
              <StageLabel
                v-if="showImage"
                :state="stage"
                variant="badge"
                data-testid="preview-source"
              />
              <WipeDivider
                v-if="showImage"
                v-model="splitModel"
                :label="t('preview.divider', { left: leftLabel, right: rightLabel })"
                :left-name="leftLabel"
              />
              <ImageMessages :error="camera.errorMessage" :hint="null" />
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
            <LookBar v-if="showImage" />
          </div>
        </div>

        <!-- Without a correction the placeholder says what is missing; the column stays empty. -->
        <div
          class="flex flex-col overflow-hidden rounded-lg border border-zinc-500 bg-zinc-50 text-zinc-800"
          data-testid="preview-side"
        >
          <div class="border-b-(length:--band-line) border-zinc-700 bg-zinc-200 p-1.5">
            <ChoiceChips
              variant="segmented"
              :options="viewOptions"
              :selected="view"
              :aria-label="t('preview.viewLabel')"
              data-testid="preview-view"
              @choose="view = $event"
            />
          </div>
          <!-- The views take the height the image gives the column and scroll inside where they
               need more (the grays on a narrow window), so that the preview keeps the height of
               its image, and with it the export. -->
          <div class="relative min-h-0 flex-1">
            <div
              v-if="view === 'colors'"
              class="focus-ring-inset absolute inset-0 flex flex-col gap-2 overflow-y-auto p-2"
            >
              <div v-if="tiles.length > 0" class="min-h-24 flex-1">
                <ColorTiles :cards="tiles" />
              </div>
              <p
                v-else-if="model !== null"
                class="text-[11px] leading-snug text-zinc-600"
                data-testid="preview-side-empty"
              >
                {{ t('preview.emptyNoCards') }}
              </p>
              <p v-if="tiles.length > 0" class="text-[10px] leading-snug text-zinc-500">
                {{
                  t(
                    fittedReference === null
                      ? 'preview.tilesLegendNoTarget'
                      : 'preview.tilesLegend',
                  )
                }}
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
            <div
              v-else
              class="focus-ring-inset absolute inset-0 flex flex-col gap-2 overflow-y-auto p-2"
            >
              <div v-if="rows.length > 0" class="min-h-24 flex-1">
                <GrayWedge :rows="rows" />
              </div>
              <p
                v-else-if="model !== null"
                class="text-[11px] leading-snug text-zinc-600"
                data-testid="preview-side-empty"
              >
                {{ t('preview.emptyNoCards') }}
              </p>
              <dl v-if="changes.length > 0" class="space-y-1.5" data-testid="zone-changes">
                <div v-for="zone in changes" :key="zone.name" class="text-[11px] leading-snug">
                  <dt class="font-semibold">{{ zone.name }}</dt>
                  <!-- Room for three lines, so the gray wedge keeps its size when the texts change. A
                     channel with its value never breaks apart. -->
                  <dd class="min-h-[3lh]">
                    {{ brightnessText(zone.brighter) }}
                    <template v-if="zone.casts.length === 0">{{ t('preview.neutral') }}</template>
                    <template v-for="cast in zone.casts" :key="cast.key">
                      ·
                      <span class="whitespace-nowrap">
                        <i
                          class="inline-block size-2 rounded-full"
                          :style="{ background: CAST_COLORS[cast.key] }"
                        ></i>
                        {{ cast.channel }} {{ signedPoints(cast.points) }}
                      </span>
                    </template>
                  </dd>
                </div>
              </dl>
              <p v-if="changes.length > 0" class="text-[10px] leading-snug text-zinc-500">
                {{ t('preview.pointsLegend') }}
              </p>
            </div>
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
