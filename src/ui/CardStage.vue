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

import { useCameraStore } from '../camera/camera-store';
import { drawFrame } from '../camera/draw-frame';
import type { Frame } from '../camera/frame';
import type { ChartStore } from '../chart/chart-store';
import { detectCards, sameCards } from '../chart/detect';
import type { ChartLayout, Corners } from '../chart/types';

import { frameGrid, measureTick, MEASURE_INTERVAL_MS } from './gray-monitor';
import { guideCorners } from './guide';
import { buildShapes, clientToImage, instructionFor } from './overlay-geometry';
import { attachStream, captureFromVideo, grabVideoFrame } from './video-bindings';

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

// Höhe (in rem) von allem außer dem Bild: Seitenkopf, Hinweiszeile, Knopfleiste und Abstände.
const CHROME_REM = 12;

// Automatik im Livebild: so oft wird nach den Karten gesucht, und so oft hintereinander müssen sie
// gefunden werden, bevor das Standbild aufgenommen wird (ein verwackeltes Bild zählt nicht).
const AUTO_INTERVAL_MS = 1000;
const AUTO_CONFIRMATIONS = 2;
// So weit (Anteil der Bildbreite) dürfen die Ecken zwischen zwei Suchläufen wandern: sonst bewegt sich
// jemand noch, und das gemittelte Standbild wäre verwackelt.
const STEADY_SHARE = 0.02;

const camera = useCameraStore();
const { stream, actual, status, still, autoDetect } = storeToRefs(camera);
const { points, nextSlot, ready, corners } = storeToRefs(props.store);

const video = useTemplateRef<HTMLVideoElement>('video');
const canvas = useTemplateRef<HTMLCanvasElement>('canvas');
const detectMessage = ref<string | null>(null);
const dragging = ref<{ card: number; index: number } | null>(null);
// Erst wenn das Video ein Bild liefert, ist eine Aufnahme sinnvoll.
const videoReady = ref(false);

const isLive = computed(() => status.value === 'live');
const showStill = computed(() => still.value !== null);
const size = computed(() => still.value ?? actual.value ?? { width: 1280, height: 720 });
const viewBox = computed(() => `0 0 ${String(size.value.width)} ${String(size.value.height)}`);
// Hilfsrahmen, solange noch keine Eckpunkte gesetzt sind.
const noPoints = computed(() => Object.keys(points.value).length === 0);
const guides = computed(() =>
  noPoints.value
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
// Die Automatik sucht nur im laufenden Livebild, solange noch keine Eckpunkte gesetzt sind.
const autoActive = computed(
  () => autoDetect.value && isLive.value && videoReady.value && !showStill.value && noPoints.value,
);
const shapes = computed(() => buildShapes(props.layout, corners.value));
const handles = computed(() =>
  showStill.value
    ? Object.entries(points.value).flatMap(([card, list]) =>
        list.map((point, index) => ({ card: Number(card), index, point })),
      )
    : [],
);
// Bild und Knöpfe sollen zusammen auf einen Bildschirm passen: die Bildhöhe ist auf die Fensterhöhe
// abzüglich Kopfzeile, Hinweiszeile und Knopfleiste begrenzt (Breite = Höhe × Seitenverhältnis).
const imageMaxWidth = computed(
  () =>
    `calc((100vh - ${String(CHROME_REM)}rem) * ${String(size.value.width / size.value.height)})`,
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

function detect(): void {
  const frame = still.value;
  /* v8 ignore next 4 -- der Knopf erscheint nur mit Standbild */
  if (frame === null) {
    return;
  }
  const found = detectCards(frame, props.layout.cards.length);
  if (found === null) {
    detectMessage.value =
      'Die Karten wurden nicht sicher erkannt. Bitte setze die Eckpunkte von Hand.';
  } else {
    props.store.setCards(found);
    detectMessage.value =
      'Die Karten wurden erkannt. Prüfe die Eckpunkte und ziehe sie bei Bedarf zurecht.';
  }
}

function alignToGuides(): void {
  props.store.setCards(guideCorners(size.value, props.layout.cards.length));
  detectMessage.value =
    'Die Eckpunkte sitzen auf den Rahmen. Ziehe sie bei Bedarf auf die Kartenecken.';
}

function capture(): void {
  void captureFromVideo(video.value, (grabber) => camera.captureStill(grabber));
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

const hits = ref(0);
const previous = ref<Corners[] | null>(null);
const capturing = ref(false);

// Nimmt das Standbild auf und setzt die Ecken (auf dem gemittelten Standbild noch einmal genauer
// gesucht) und beendet die Kamera. Passt das Standbild nicht zu den Ecken aus dem Livebild (die
// Karten wurden beim Mitteln bewegt), wird es verworfen und die Suche läuft weiter.
async function autoCapture(fromLive: Corners[]): Promise<void> {
  capturing.value = true;
  await captureFromVideo(video.value, (grabber) => camera.captureStill(grabber));
  const frame = still.value;
  /* v8 ignore next 4 -- ein Aufnahmefehler wird vom Kamera-Store gemeldet */
  if (frame === null) {
    capturing.value = false;
    return;
  }
  const found = detectCards(frame, props.layout.cards.length);
  if (found !== null && sameCards(found, fromLive, STEADY_SHARE * frame.width)) {
    props.store.setCards(found);
    camera.stop();
    await nextTick();
    detectMessage.value =
      'Die Karten wurden erkannt und das Standbild aufgenommen. Prüfe die Eckpunkte und ziehe sie bei Bedarf zurecht.';
  } else {
    camera.clearStill();
  }
  capturing.value = false;
}

// Trifft die Suche dieselben Karten an derselben Stelle wie beim letzten Mal?
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

const timer = shallowRef<ReturnType<typeof setInterval>>();
const autoTimer = shallowRef<ReturnType<typeof setInterval>>();

onMounted(() => {
  attachStream(video.value, stream.value);
  drawStill(still.value);
  timer.value = setInterval(() => {
    const active = props.liveMeasure && ready.value && isLive.value && !showStill.value;
    measureTick(active, video.value, (grid) => {
      props.store.measure(grid);
    });
  }, MEASURE_INTERVAL_MS);
  autoTimer.value = setInterval(() => {
    void autoTick();
  }, AUTO_INTERVAL_MS);
});

onBeforeUnmount(() => {
  clearInterval(timer.value);
  clearInterval(autoTimer.value);
});

watch(stream, (next) => {
  videoReady.value = false;
  attachStream(video.value, next);
});

watch(still, (next) => {
  detectMessage.value = null;
  drawStill(next);
});

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
    <p v-if="!isLive && !showStill" class="text-sm text-amber-800">
      Die Kamera ist aus. Schalte sie oben mit „Kamera“ ein, um ein Standbild aufzunehmen.
    </p>
    <p v-else-if="!videoReady" class="text-sm text-slate-600">
      Die Kamera startet, einen Moment bitte …
    </p>

    <p class="text-sm font-medium" aria-live="polite">{{ instruction }}</p>

    <div class="flex items-stretch gap-3">
      <div class="relative min-w-0 flex-1" :style="{ maxWidth: imageMaxWidth }">
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

    <p v-if="autoActive" class="text-sm text-slate-700" data-testid="auto-hint">
      Halte die Karten in die Rahmen. Sobald sie erkannt sind, nimmt die App das Standbild selbst
      auf und schaltet die Kamera aus.
    </p>
    <p v-if="detectMessage !== null" class="text-sm text-slate-700" data-testid="detect-message">
      {{ detectMessage }}
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
      <button
        v-if="showStill"
        type="button"
        class="rounded border px-3 py-1 text-sm"
        @click="alignToGuides"
      >
        Eckpunkte auf Rahmen setzen
      </button>
      <button
        v-if="showStill"
        type="button"
        class="rounded border px-3 py-1 text-sm"
        @click="detect"
      >
        Karten automatisch erkennen
      </button>
      <button type="button" class="rounded border px-3 py-1 text-sm" @click="store.reset()">
        Eckpunkte zurücksetzen
      </button>
      <label class="flex items-center gap-2 text-sm">
        <input v-model="autoDetect" type="checkbox" />
        Karten im Livebild automatisch erkennen
      </label>
      <slot name="actions" />
    </div>
  </div>
</template>
