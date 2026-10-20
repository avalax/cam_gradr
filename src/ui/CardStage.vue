<script setup lang="ts">
import { storeToRefs } from 'pinia';
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  useTemplateRef,
  watch,
} from 'vue';
import { useI18n } from 'vue-i18n';

import { useCameraStore } from '../camera/camera-store';
import { drawFrame } from '../camera/draw-frame';
import type { Frame } from '../camera/frame';
import type { ChartStore } from '../chart/chart-store';
import { detectCards, sameCards } from '../chart/detect';
import type { ChartLayout, Corners } from '../chart/types';

import { imageMaxWidth as maxWidthFor } from './image-size';
import { frameGrid } from './gray-monitor';
import { guideCorners } from './guide';
import { buildShapes, clientToImage } from './overlay-geometry';
import { attachStream, captureFromVideo, grabVideoFrame } from './video-bindings';

const props = defineProps<{
  store: ChartStore;
  layout: ChartLayout;
  // Names of the cards for the click instruction, e.g. { 3: 'left gray card (50 %)' }.
  cardNames: Readonly<Record<number, string>>;
  // Hint shown while no still image has been captured yet.
  idleText: string;
}>();

// Automation in the live image: how often the cards are searched for, and how many times in a row
// they must be found before the still image is captured (a shaky image does not count).
const AUTO_INTERVAL_MS = 500;
const AUTO_CONFIRMATIONS = 2;
// How far (fraction of the image width) the corners may move between two searches: otherwise
// someone is still moving, and the averaged still image would be blurred.
const STEADY_SHARE = 0.03;

const { t } = useI18n();
const camera = useCameraStore();
const { stream, actual, status, still } = storeToRefs(camera);
const { points, corners, rotated } = storeToRefs(props.store);

const video = useTemplateRef<HTMLVideoElement>('video');
const canvas = useTemplateRef<HTMLCanvasElement>('canvas');
// Set after an automatic capture; the message is looked up when rendered, so it follows the language.
const detected = ref(false);
const dragging = ref<{ card: number; index: number } | null>(null);
// A capture only makes sense once the video delivers an image.
const videoReady = ref(false);

const isLive = computed(() => status.value === 'live');
const showStill = computed(() => still.value !== null);
const size = computed(() => still.value ?? actual.value ?? { width: 1280, height: 720 });
const viewBox = computed(() => `0 0 ${String(size.value.width)} ${String(size.value.height)}`);
// Guide frame while no corner points have been set yet.
const noPoints = computed(() => Object.keys(points.value).length === 0);
// Guide frame only in the live image: with the camera off, the placeholder shows what matters.
const guides = computed(() =>
  noPoints.value && isLive.value
    ? guideCorners(size.value, props.layout.cards.length).map((corners, index) => {
        const card = Number(props.layout.cards[index]?.card);
        return {
          key: String(card),
          points: corners.map((p) => `${String(p.x)},${String(p.y)}`).join(' '),
          label: props.cardNames[card] ?? '',
          at: corners[0],
        };
      })
    : [],
);
// The automation searches the running live image while no corner points have been set yet.
const autoActive = computed(
  () => isLive.value && videoReady.value && !showStill.value && noPoints.value,
);
// Without a camera image and without a still image the picture area only shows the placeholder;
// saved corner points (for example from a project) are then not drawn over it.
const showPlaceholder = computed(() => !isLive.value && !showStill.value);
const shapes = computed(() =>
  showPlaceholder.value ? [] : buildShapes(props.layout, corners.value),
);
const handles = computed(() =>
  showStill.value
    ? Object.entries(points.value).flatMap(([card, list]) =>
        list.map((point, index) => ({ card: Number(card), index, point })),
      )
    : [],
);
// Image and buttons should fit on one screen together: the image height is limited to the window
// height minus header, hint line and button bar (width = height × aspect ratio).
const imageMaxWidth = computed(() => maxWidthFor(size.value.width / size.value.height));

function imagePoint(event: PointerEvent | MouseEvent) {
  const rect = (event.currentTarget as SVGSVGElement).getBoundingClientRect();
  return clientToImage({ x: event.clientX, y: event.clientY }, rect, size.value);
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

function drawStill(frame: Frame | null): void {
  const element = canvas.value;
  const context = element?.getContext('2d');
  if (element !== null && frame !== null && context) {
    element.width = frame.width;
    element.height = frame.height;
    drawFrame(context, frame);
  }
}

// Discards corner points and still image and turns the camera on if it is off (the automation
// turns it off after the capture): the search starts over in the live image.
function redetect(): void {
  props.store.reset();
  camera.clearStill();
  if (!isLive.value) {
    void camera.start();
  }
}

const hits = ref(0);
const previous = ref<Corners[] | null>(null);
const capturing = ref(false);

// Captures the still image, sets the corners (searched once more, more precisely, on the averaged
// still image) and stops the camera. If the still image does not match the corners from the live
// image (the cards were moved during averaging), it is discarded and the search continues.
async function autoCapture(fromLive: Corners[]): Promise<void> {
  capturing.value = true;
  await captureFromVideo(video.value, (grabber) => camera.captureStill(grabber));
  const frame = still.value;
  /* v8 ignore next 4 -- a capture error is reported by the camera store */
  if (frame === null) {
    capturing.value = false;
    return;
  }
  const found = detectCards(frame, props.layout.cards.length);
  if (found !== null && sameCards(found, fromLive, STEADY_SHARE * frame.width)) {
    props.store.setCards(found);
    camera.stop();
    await nextTick();
    detected.value = true;
  } else {
    camera.clearStill();
  }
  capturing.value = false;
}

// Does the search hit the same cards in the same place as last time?
function isSteady(found: Corners[], width: number): boolean {
  return previous.value !== null && sameCards(found, previous.value, STEADY_SHARE * width);
}

async function autoTick(): Promise<void> {
  const frame = capturing.value || !autoActive.value ? null : grabVideoFrame(video.value);
  const found = frame === null ? null : detectCards(frame, props.layout.cards.length);
  hits.value = found === null ? 0 : isSteady(found, Number(frame?.width)) ? hits.value + 1 : 1;
  previous.value = found;
  if (found !== null && hits.value >= AUTO_CONFIRMATIONS) {
    hits.value = 0;
    previous.value = null;
    await autoCapture(found);
  }
}

const autoTimer = shallowRef<ReturnType<typeof setInterval>>();

onMounted(() => {
  attachStream(video.value, stream.value);
  drawStill(still.value);
  autoTimer.value = setInterval(() => {
    void autoTick();
  }, AUTO_INTERVAL_MS);
});

onBeforeUnmount(() => {
  clearInterval(autoTimer.value);
  // When leaving the tab, the previous state applies again.
  props.store.endSearch();
});

watch(stream, (next) => {
  videoReady.value = false;
  attachStream(video.value, next);
});

watch(still, (next) => {
  detected.value = false;
  drawStill(next);
});

// While the camera is running, this tab searches for new cards: the previous state (still image with corner points)
// is kept, the corner points disappear so that a new still image can be created. If the
// camera ends without new corner points, the previous state applies again. Only still images are measured.
const searching = computed(() => status.value === 'live' || status.value === 'starting');
watch(
  searching,
  (active) => {
    if (active) {
      props.store.beginSearch();
    } else {
      props.store.endSearch();
    }
  },
  { immediate: true },
);

// On the still image, every change (new image, moved corner points) triggers a new measurement.
watch([still, points], () => {
  const frame = still.value;
  if (frame !== null) {
    props.store.measure(frameGrid(frame));
  }
});

// Corner points only apply to one image size; start over at a different resolution.
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
    <div class="flex items-stretch gap-3">
      <div class="relative min-w-0 flex-1" :style="{ maxWidth: imageMaxWidth }">
        <!-- Placeholder the size of the image while the camera is off and there is no still image. -->
        <div
          v-if="showPlaceholder"
          class="flex w-full flex-col items-center justify-center gap-3 rounded border-2 border-dashed border-zinc-300 bg-zinc-100 p-6 text-center text-zinc-600"
          :style="{ aspectRatio: size.width / size.height }"
          data-testid="card-placeholder"
        >
          <svg
            class="w-28 text-zinc-400"
            viewBox="0 0 96 60"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-dasharray="5 4"
            aria-hidden="true"
          >
            <rect x="14" y="3" width="30" height="54" rx="4" />
            <rect x="52" y="3" width="30" height="54" rx="4" />
          </svg>
          <p class="max-w-xs text-sm leading-snug">
            <template v-if="status === 'starting'">
              <span class="block font-semibold text-zinc-800">{{
                t('cards.stage.starting.title')
              }}</span>
              {{ t('cards.stage.starting.text') }}
            </template>
            <template v-else>
              <span class="block font-semibold text-zinc-800">{{
                t('cards.stage.off.title')
              }}</span>
              {{ t('cards.stage.off.text') }} {{ idleText }}
            </template>
          </p>
        </div>
        <video
          v-show="isLive && !showStill"
          ref="video"
          class="w-full rounded bg-black"
          :style="{ aspectRatio: size.width / size.height }"
          muted
          playsinline
          @loadeddata="videoReady = true"
        ></video>
        <canvas v-show="showStill" ref="canvas" class="w-full rounded bg-black"></canvas>
        <!-- The corner points are set by pointer; keyboard-only operation makes no sense here. -->
        <!-- eslint-disable-next-line vuejs-accessibility/click-events-have-key-events, vuejs-accessibility/no-static-element-interactions -->
        <svg
          class="absolute inset-0 h-full w-full touch-none"
          :viewBox="viewBox"
          @pointermove="onMove"
          @pointerup="endDrag"
          @pointerleave="endDrag"
        >
          <g v-for="guide in guides" :key="guide.key" data-testid="guide" pointer-events="none">
            <polygon
              :points="guide.points"
              fill="none"
              stroke="#ffffff"
              stroke-width="3"
              stroke-dasharray="14 10"
            />
            <text
              :x="guide.at.x + 10"
              :y="guide.at.y + 30"
              fill="#ffffff"
              stroke="#0f172a"
              stroke-width="4"
              paint-order="stroke"
              font-size="24"
            >
              {{ guide.label }}
            </text>
          </g>
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
        <!-- Toolbar in the image corner: delete corner points and still image. -->
        <div
          v-if="showStill || !noPoints"
          class="absolute right-0 top-0 z-10 flex overflow-hidden rounded-bl-lg border-b border-l border-zinc-500 bg-zinc-50 text-zinc-800"
          role="toolbar"
          :aria-label="t('cards.stage.toolbar')"
        >
          <button
            type="button"
            class="grid h-9 w-10 place-items-center hover:bg-zinc-800 hover:text-zinc-50 focus-visible:bg-zinc-800 focus-visible:text-zinc-50"
            :aria-label="t('cards.stage.deleteCorners')"
            :title="t('cards.stage.deleteCornersTitle')"
            @click="redetect"
          >
            <svg
              class="size-[18px]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path
                d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"
              />
            </svg>
          </button>
        </div>
      </div>
      <slot name="side" />
    </div>

    <p v-if="camera.errorMessage !== null && isLive" class="text-sm text-red-700" role="alert">
      {{ camera.errorMessage }}
    </p>

    <p v-if="autoActive" class="text-sm text-slate-700" data-testid="auto-hint">
      {{ t('cards.stage.autoHint') }}
    </p>
    <p v-if="rotated" class="text-sm text-slate-700" data-testid="rotated-note">
      {{ t('cards.stage.rotated') }}
    </p>
    <p v-if="detected" class="text-sm text-slate-700" data-testid="detect-message">
      {{ t('cards.stage.detected') }}
    </p>
  </div>
</template>
