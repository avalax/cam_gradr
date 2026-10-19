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

import { imageMaxWidth as maxWidthFor } from './image-size';
import { frameGrid } from './gray-monitor';
import { guideCorners } from './guide';
import { buildShapes, clientToImage } from './overlay-geometry';
import { attachStream, captureFromVideo, grabVideoFrame } from './video-bindings';

const props = defineProps<{
  store: ChartStore;
  layout: ChartLayout;
  // Namen der Karten für die Klickanweisung, z. B. { 3: 'linke Graukarte (50 %)' }.
  cardNames: Readonly<Record<number, string>>;
  // Hinweis, solange noch kein Standbild aufgenommen ist.
  idleText: string;
}>();

// Automatik im Livebild: so oft wird nach den Karten gesucht, und so oft hintereinander müssen sie
// gefunden werden, bevor das Standbild aufgenommen wird (ein verwackeltes Bild zählt nicht).
const AUTO_INTERVAL_MS = 1000;
const AUTO_CONFIRMATIONS = 2;
// So weit (Anteil der Bildbreite) dürfen die Ecken zwischen zwei Suchläufen wandern: sonst bewegt sich
// jemand noch, und das gemittelte Standbild wäre verwackelt.
const STEADY_SHARE = 0.02;

const camera = useCameraStore();
const { stream, actual, status, still } = storeToRefs(camera);
const { points, corners, rotated } = storeToRefs(props.store);

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
// Hilfsrahmen nur im Livebild: Bei ausgeschalteter Kamera zeigt der Platzhalter das Wichtige.
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
// Die Automatik sucht im laufenden Livebild, solange noch keine Eckpunkte gesetzt sind.
const autoActive = computed(
  () => isLive.value && videoReady.value && !showStill.value && noPoints.value,
);
// Ohne Kamerabild und ohne Standbild zeigt die Bildfläche nur den Platzhalter; gespeicherte Eckpunkte
// (zum Beispiel aus einem Projekt) werden dann nicht darüber gezeichnet.
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
// Bild und Knöpfe sollen zusammen auf einen Bildschirm passen: die Bildhöhe ist auf die Fensterhöhe
// abzüglich Kopfzeile, Hinweiszeile und Knopfleiste begrenzt (Breite = Höhe × Seitenverhältnis).
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

// Verwirft Eckpunkte und Standbild und schaltet die Kamera ein, falls sie aus ist (die Automatik
// schaltet sie nach der Aufnahme aus): Im Livebild beginnt die Suche von vorn.
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
  // Beim Verlassen des Tabs gilt wieder der bisherige Stand.
  props.store.endSearch();
});

watch(stream, (next) => {
  videoReady.value = false;
  attachStream(video.value, next);
});

watch(still, (next) => {
  detectMessage.value = null;
  drawStill(next);
});

// Läuft die Kamera, sucht dieser Tab nach neuen Karten: Der bisherige Stand (Standbild mit Eckpunkten)
// bleibt gehalten, die Eckpunkte verschwinden, damit ein neues Standbild entstehen kann. Endet die
// Kamera ohne neue Eckpunkte, gilt wieder der bisherige Stand. Gemessen wird nur auf Standbildern.
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
    <div class="flex items-stretch gap-3">
      <div class="relative min-w-0 flex-1" :style="{ maxWidth: imageMaxWidth }">
        <!-- Platzhalter in der Größe des Bildes, solange die Kamera aus ist und es kein Standbild gibt. -->
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
              <span class="block font-semibold text-zinc-800">Die Kamera startet …</span>
              Einen Moment bitte.
            </template>
            <template v-else>
              <span class="block font-semibold text-zinc-800">Die Kamera ist aus</span>
              Schalte sie oben mit „Kamera“ ein. {{ idleText }}
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
        <!-- Die Eckpunkte werden per Zeiger gesetzt; reine Tastaturbedienung ist hier nicht sinnvoll. -->
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
        <!-- Symbolleiste in der Bildecke: Eckpunkte und Standbild löschen. -->
        <div
          v-if="showStill || !noPoints"
          class="absolute right-0 top-0 z-10 flex overflow-hidden rounded-bl-lg border-b border-l border-zinc-500 bg-zinc-50 text-zinc-800"
          role="toolbar"
          aria-label="Bildaktionen"
        >
          <button
            type="button"
            class="grid h-9 w-10 place-items-center hover:bg-zinc-800 hover:text-zinc-50 focus-visible:bg-zinc-800 focus-visible:text-zinc-50"
            aria-label="Eckpunkte löschen"
            title="Eckpunkte löschen und die Karten neu erkennen"
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
      Halte die Karten in die Rahmen. Sobald sie erkannt sind, nimmt die App das Standbild selbst
      auf und schaltet die Kamera aus.
    </p>
    <p v-if="rotated" class="text-sm text-slate-700" data-testid="rotated-note">
      Die Karten sind um 180° gedreht. Die Zuordnung der Felder wurde entsprechend angepasst.
    </p>
    <p v-if="detectMessage !== null" class="text-sm text-slate-700" data-testid="detect-message">
      {{ detectMessage }}
    </p>
  </div>
</template>
