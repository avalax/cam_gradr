import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';

import { sortCorners } from './corner-order';
import { assessExposure } from './exposure';
import type { ExposureResult } from './exposure';
import { grayLayout, colorLayout } from './layouts';
import { measureChart, exposureInput } from './measure';
import type { Measurements } from './measure';
import type { ChartLayout, Corners, PixelGrid, Point } from './types';

// Reihenfolge der Graukarten bei der Eckpunktwahl: links (50 %), dann rechts (18 %).
export const GRAY_CARD_ORDER = [3, 4] as const;
// Reihenfolge der Farbkarten: links (Spalten A–D), dann rechts (Spalten E–H).
const COLOR_CARD_ORDER = [1, 2] as const;
export const CORNERS_PER_CARD = 4;

interface CornerSlot {
  card: number;
  index: number;
}

interface ChartStoreOptions {
  id: string;
  layout: ChartLayout;
  cardOrder: readonly number[];
  // Nur die Graukarten bewerten zusätzlich die Raumhelligkeit.
  assessLighting: boolean;
}

// Zustand für eine Kartengruppe (Karten, Eckpunkte, Messwerte); eine Instanz je Schritt.
function defineChartStore(options: ChartStoreOptions) {
  return defineStore(options.id, () => {
    const points = ref<Record<number, Point[]>>({});
    const measurements = shallowRef<Measurements>({});
    const exposure = shallowRef<ExposureResult | null>(null);

    function placed(card: number): Point[] {
      return points.value[card] ?? [];
    }

    // Nächster freier Eckpunkt in der festen Reihenfolge, oder null, wenn alles gesetzt ist.
    const nextSlot = computed<CornerSlot | null>(() => {
      for (const card of options.cardOrder) {
        if (placed(card).length < CORNERS_PER_CARD) {
          return { card, index: placed(card).length };
        }
      }
      return null;
    });

    const ready = computed(() => nextSlot.value === null);

    const corners = computed<Record<number, Corners | undefined>>(() => {
      const result: Record<number, Corners | undefined> = {};
      for (const card of options.cardOrder) {
        const [a, b, c, d] = placed(card);
        if (a !== undefined && b !== undefined && c !== undefined && d !== undefined) {
          // Die Reihenfolge der Klicks ist egal: die Ecken werden selbst einsortiert.
          result[card] = sortCorners([a, b, c, d]);
        }
      }
      return result;
    });

    function addCorner(point: Point): void {
      const slot = nextSlot.value;
      if (slot !== null) {
        points.value = { ...points.value, [slot.card]: [...placed(slot.card), point] };
      }
    }

    function moveCorner(card: number, index: number, point: Point): void {
      const list = placed(card);
      if (index < list.length) {
        points.value = {
          ...points.value,
          [card]: list.map((old, i) => (i === index ? point : old)),
        };
      }
    }

    function reset(): void {
      points.value = {};
      measurements.value = {};
      exposure.value = null;
    }

    // Misst die Felder im aktuellen Bild (bei den Graukarten zusätzlich die Raumhelligkeit).
    function measure(grid: PixelGrid): void {
      measurements.value = measureChart(options.layout, corners.value, grid);
      if (options.assessLighting) {
        const input = exposureInput(measurements.value);
        exposure.value = input === null ? null : assessExposure(input);
      }
    }

    return {
      points,
      measurements,
      exposure,
      nextSlot,
      ready,
      corners,
      addCorner,
      moveCorner,
      reset,
      measure,
    };
  });
}

export const useChartStore = defineChartStore({
  id: 'chart',
  layout: grayLayout,
  cardOrder: GRAY_CARD_ORDER,
  assessLighting: true,
});

export const useColorChartStore = defineChartStore({
  id: 'chart-color',
  layout: colorLayout,
  cardOrder: COLOR_CARD_ORDER,
  assessLighting: false,
});

export type ChartStore = ReturnType<typeof useChartStore>;
