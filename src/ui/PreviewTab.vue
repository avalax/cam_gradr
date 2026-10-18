<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef, watch } from 'vue';

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
import { imageMaxWidth as maxWidthFor } from './image-size';
import GrayWedge from './GrayWedge.vue';
import { attachStream, captureFromVideo } from './video-bindings';
import WipeDivider from './WipeDivider.vue';

// Stützstellen der LUT in der Vorschau; fein genug für glatte Verläufe, schnell genug zu berechnen.
const PREVIEW_LUT_SIZE = 33;
// Mindestens ein aktuelles Videobild liegt vor (HTMLMediaElement.HAVE_CURRENT_DATA).
const HAVE_CURRENT_DATA = 2;

const camera = useCameraStore();
const solve = useSolveStore();
const preview = usePreviewStore();
const { stream, status, still } = storeToRefs(camera);
const { model, result } = storeToRefs(solve);
const { split } = storeToRefs(preview);
const { measurements } = storeToRefs(useColorChartStore());
const { selected } = storeToRefs(useReferenceStore());

// Ansicht der Seitenspalte: zuerst die Farben, dazu umschaltbar die Graustufen.
const VIEWS = [
  { key: 'colors', label: 'Farben' },
  { key: 'grays', label: 'Graustufen' },
] as const;
const view = ref<(typeof VIEWS)[number]['key']>('colors');
const WORST_COUNT = 3;

// Farbraster aus den gemessenen bunten Feldern und die Felder mit der größten Rest-Abweichung.
const tiles = computed(() =>
  colorCards(colorLayout, NEUTRAL_IDS, measurements.value, model.value, selected.value),
);
const worst = computed(() =>
  result.value === null ? [] : worstPatches(result.value.report, WORST_COUNT),
);

// Graukeil aus den gemessenen Neutralfeldern und was die Korrektur je Tonbereich ändert.
const rows = computed(() =>
  wedgeRows(NEUTRAL_IDS, measurements.value, model.value, selected.value),
);
const changes = computed(() => (model.value === null ? [] : zoneChanges(model.value)));
const emptyText = computed(() =>
  model.value === null
    ? 'Noch keine Korrektur. Berechne sie zuerst im Tab „Farbkarten“.'
    : 'Für diese Ansicht fehlen gemessene Farbkarten.',
);
// Farben der Punkte vor den Kanälen.
const CAST_COLORS: Readonly<Record<string, string>> = {
  Rot: '#b45353',
  Grün: '#4f8f5b',
  Blau: '#4f6fb4',
};

const video = useTemplateRef<HTMLVideoElement>('video');
const canvas = useTemplateRef<HTMLCanvasElement>('canvas');
const error = ref<string | null>(null);
// Erst wenn das Video ein Bild liefert, ist eine Aufnahme sinnvoll.
const videoReady = ref(false);

const isLive = computed(() => status.value === 'live');
const lut = computed(() => (model.value === null ? null : buildLut(model.value, PREVIEW_LUT_SIZE)));
const hasSource = computed(() => isLive.value || still.value !== null);
const aspect = ref(16 / 9);
const maxWidth = computed(() => maxWidthFor(aspect.value));

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

// Wählt die Bildquelle: das Standbild dieses Tabs, sonst das Livebild.
function currentSource(): { image: RenderSource; width: number; height: number } | null {
  if (still.value !== null && stillCanvas.width > 0) {
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

function capture(): void {
  void captureFromVideo(video.value, (grabber) => camera.captureStill(grabber));
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
  /* v8 ignore next 3 -- die Zeichenfläche existiert, sobald die Komponente eingehängt ist */
  if (target === null) {
    return;
  }
  const gl = target.getContext('webgl2', { preserveDrawingBuffer: true });
  try {
    // Ohne WebGL2 übernimmt die Software-Darstellung, damit die Vorschau trotzdem funktioniert.
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
watch(still, drawStill);
watch(lut, (next) => {
  if (next !== null) {
    renderer.value?.setLut(next);
  }
});

// Der Wischer über dem Bild schreibt die Lage der Trennlinie in den Speicher.
// Mittlere Abweichung vor und nach der Korrektur, solange der Bericht vorliegt.
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
        Die Vorschau zeigt das Kamerabild mit der berechneten Farbkorrektur. Links der Trennlinie
        siehst du das Original, rechts das korrigierte Bild. Den Strich kannst du im Bild ziehen
        oder mit den Pfeiltasten verschieben.
      </p>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded bg-emerald-700 px-3 py-1 text-sm text-white disabled:opacity-50"
          :disabled="!isLive || !videoReady"
          @click="capture"
        >
          {{ still === null ? 'Standbild aufnehmen' : 'Neues Standbild aufnehmen' }}
        </button>
        <button
          v-if="still !== null"
          type="button"
          class="rounded border px-3 py-1 text-sm"
          @click="camera.clearStill()"
        >
          Zurück zum Livebild
        </button>
      </div>
      <p v-if="error !== null" class="text-sm text-red-700" role="alert">{{ error }}</p>
      <p
        v-if="renderer !== null"
        class="text-xs text-slate-600"
        data-testid="preview-renderer"
        :data-renderer="renderer.kind"
      >
        {{
          renderer.kind === 'webgl2'
            ? 'Darstellung: Grafikkarte (WebGL2)'
            : 'Darstellung: Software, verkleinert (kein WebGL2 verfügbar)'
        }}
      </p>
    </aside>

    <div class="min-w-0 lg:col-start-1 lg:row-start-1">
      <!-- Wie in den Kartentabs: links das Bild, rechts eine schmale Spalte; so ist das Bild überall gleich groß. -->
      <div class="flex items-stretch gap-3">
        <div class="relative min-w-0 flex-1" :style="{ maxWidth: maxWidth }">
          <!-- Das Video dient nur als Bildquelle und bleibt unsichtbar. -->
          <video
            ref="video"
            class="hidden"
            muted
            playsinline
            @loadeddata="videoReady = true"
          ></video>
          <!-- Platzhalter in der Größe des Bildes, solange es nichts zu zeigen gibt. -->
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
              <span class="block font-semibold text-zinc-800">Noch keine Farbkorrektur</span>
              Berechne sie zuerst im Tab „Farbkarten“. Dann siehst du hier das Kamerabild vorher und
              nachher.
            </p>
            <p v-else class="max-w-xs text-sm leading-snug" data-testid="preview-no-source">
              <span class="block font-semibold text-zinc-800">Noch kein Bild</span>
              Schalte oben die Kamera an, um das Livebild zu sehen oder ein Standbild aufzunehmen.
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
            label="Trennlinie: links Original, rechts korrigiert"
          />
        </div>

        <div
          class="flex w-44 shrink-0 flex-col overflow-hidden rounded-lg border border-zinc-500 bg-zinc-50 text-zinc-800"
          data-testid="preview-side"
        >
          <div
            class="flex gap-1 border-b-[3px] border-zinc-700 bg-zinc-200 p-1.5"
            role="group"
            aria-label="Ansicht der Seitenspalte"
          >
            <button
              v-for="option in VIEWS"
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
              Jedes Feld: Soll, Kamera, korrigiert (von links nach rechts).
            </p>
            <div
              v-if="worst.length > 0"
              class="text-[11px] leading-snug"
              data-testid="worst-patches"
            >
              <p class="font-semibold">Größte Abweichung</p>
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
                <dd>
                  {{ brightnessText(zone.brighter) }}
                  <template v-if="zone.casts.length === 0">, neutral</template>
                  <template v-for="cast in zone.casts" :key="cast.channel">
                    ·
                    <i
                      class="inline-block size-2 rounded-full"
                      :style="{ background: CAST_COLORS[cast.channel] }"
                    ></i>
                    {{ cast.channel }} {{ signedPoints(cast.points) }}
                  </template>
                </dd>
              </div>
            </dl>
            <p v-if="changes.length > 0" class="text-[10px] leading-snug text-zinc-500">
              Punkte auf der Skala 0–100: + Farbe wird stärker, − schwächer.
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
      </div>
    </div>
  </section>
</template>
