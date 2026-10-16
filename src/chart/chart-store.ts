import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';

import grayLayoutJson from '../data/layouts/spyder-checkr-photo-gray.layout.json';

import { assessExposure } from './exposure';
import type { ExposureResult } from './exposure';
import { measureChart, exposureInput } from './measure';
import type { Measurements } from './measure';
import { parseLayout } from './layout';
import type { Corners, PixelGrid, Point } from './types';

// Reihenfolge der Karten bei der Eckpunktwahl: links (50 %), dann rechts (18 %).
export const GRAY_CARD_ORDER = [3, 4] as const;
export const CORNERS_PER_CARD = 4;

export const grayLayout = parseLayout(grayLayoutJson);

export interface CornerSlot {
  card: number;
  index: number;
}

export const useChartStore = defineStore('chart', () => {
  const points = ref<Record<number, Point[]>>({});
  const measurements = shallowRef<Measurements>({});
  const exposure = shallowRef<ExposureResult | null>(null);

  function placed(card: number): Point[] {
    return points.value[card] ?? [];
  }

  // Nächster freier Eckpunkt in der festen Reihenfolge, oder null, wenn alles gesetzt ist.
  const nextSlot = computed<CornerSlot | null>(() => {
    for (const card of GRAY_CARD_ORDER) {
      if (placed(card).length < CORNERS_PER_CARD) {
        return { card, index: placed(card).length };
      }
    }
    return null;
  });

  const ready = computed(() => nextSlot.value === null);

  const corners = computed<Record<number, Corners | undefined>>(() => {
    const result: Record<number, Corners | undefined> = {};
    for (const card of GRAY_CARD_ORDER) {
      const [a, b, c, d] = placed(card);
      if (a !== undefined && b !== undefined && c !== undefined && d !== undefined) {
        result[card] = [a, b, c, d];
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
      points.value = { ...points.value, [card]: list.map((old, i) => (i === index ? point : old)) };
    }
  }

  function reset(): void {
    points.value = {};
    measurements.value = {};
    exposure.value = null;
  }

  // Misst die Graukarten im aktuellen Bild und bewertet die Raumhelligkeit.
  function measure(grid: PixelGrid): void {
    measurements.value = measureChart(grayLayout, corners.value, grid);
    const input = exposureInput(measurements.value);
    exposure.value = input === null ? null : assessExposure(input);
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
