import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';

import { sortCorners } from './corner-order';
import { assessExposure, codeLuma } from './exposure';
import type { ExposureResult } from './exposure';
import { grayLayout, colorLayout } from './layouts';
import { measureChart, exposureInput } from './measure';
import type { Measurements } from './measure';
import type { ChartLayout, Corners, PixelGrid, Point } from './types';

// Order of the gray cards when picking corners: left (50 %), then right (18 %).
export const GRAY_CARD_ORDER = [3, 4] as const;
// Order of the color charts: left (columns A–D), then right (columns E–H).
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
  // Pairs (darkest, brightest patch) of a chart: they let the app detect whether the charts are
  // held rotated by 180° (the dark patch is then at the bottom instead of the top).
  orientation: readonly (readonly [string, string])[];
  // Only the gray cards also rate the room brightness.
  assessLighting: boolean;
}

// Rotates the corners of a chart by 180°: top left becomes bottom right, etc.
function halfTurn([a, b, c, d]: Corners): Corners {
  return [c, d, a, b];
}

type CornerMap = Record<number, Corners | undefined>;

// Corners and measurements of a chart group.
interface ChartState {
  points: Record<number, Point[]>;
  measurements: Measurements;
  rotated: boolean;
}

// Charts rotated by 180°: the left chart in the image is then the right chart of the layout and
// vice versa, each upside down.
function turned(upright: CornerMap, order: readonly number[]): CornerMap {
  const [first = -1, second = -1] = order;
  const left = upright[first];
  const right = upright[second];
  return left === undefined || right === undefined
    ? upright
    : { ...upright, [first]: halfTurn(right), [second]: halfTurn(left) };
}

// State for a chart group (charts, corners, measurements); one instance per step.
function defineChartStore(options: ChartStoreOptions) {
  return defineStore(options.id, () => {
    const points = ref<Record<number, Point[]>>({});
    const measurements = shallowRef<Measurements>({});
    const exposure = shallowRef<ExposureResult | null>(null);
    // Charts are rotated by 180° (detected from the measurements).
    const rotated = ref(false);
    // While the camera searches for new charts, the previous state (corners and measurements for
    // the still image) is kept here. If no new state results, the previous one comes back.
    const held = shallowRef<ChartState | null>(null);

    function placed(card: number): Point[] {
      return points.value[card] ?? [];
    }

    // Next free corner in the fixed order, or null if everything is set.
    const nextSlot = computed<CornerSlot | null>(() => {
      for (const card of options.cardOrder) {
        if (placed(card).length < CORNERS_PER_CARD) {
          return { card, index: placed(card).length };
        }
      }
      return null;
    });

    const ready = computed(() => nextSlot.value === null);

    const uprightCorners = computed<CornerMap>(() => {
      const result: CornerMap = {};
      for (const card of options.cardOrder) {
        const [a, b, c, d] = placed(card);
        if (a !== undefined && b !== undefined && c !== undefined && d !== undefined) {
          // The order of the clicks does not matter: the corners are sorted automatically.
          result[card] = sortCorners([a, b, c, d]);
        }
      }
      return result;
    });

    const corners = computed<CornerMap>(() =>
      rotated.value ? turned(uprightCorners.value, options.cardOrder) : uprightCorners.value,
    );

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

    // Sets the corners of all charts at once (automatic detection), from left to right.
    function setCards(found: readonly Corners[]): void {
      points.value = Object.fromEntries(
        options.cardOrder.map((card, index) => [card, [...(found[index] ?? [])]]),
      );
    }

    function clear(): void {
      points.value = {};
      measurements.value = {};
      exposure.value = null;
      rotated.value = false;
    }

    // Discards the state entirely, including the held one.
    function reset(): void {
      held.value = null;
      clear();
    }

    function current(): ChartState {
      return {
        points: points.value,
        measurements: measurements.value,
        rotated: rotated.value,
      };
    }

    // The valid state: the held one during the search, otherwise the current one (for saving).
    function committed(): ChartState {
      return held.value ?? current();
    }

    // The camera starts searching: the previous state is held and the corners disappear so that
    // a new still image with new corners can be created.
    function beginSearch(): void {
      if (held.value === null && Object.keys(points.value).length > 0) {
        held.value = current();
        clear();
      }
    }

    // The search ends: without new corners the previous state applies again.
    function endSearch(): void {
      const previous = held.value;
      held.value = null;
      if (previous !== null && Object.keys(points.value).length === 0) {
        restore(previous);
      }
    }

    // Restores saved corners and measurements (loading a project).
    function restore(state: ChartState): void {
      held.value = null;
      points.value = state.points;
      measurements.value = state.measurements;
      rotated.value = state.rotated;
      if (options.assessLighting) {
        const input = exposureInput(state.measurements);
        exposure.value = input === null ? null : assessExposure(input);
      }
    }

    // Measures the patches in the current image (for the gray cards also the room brightness).
    function orientationScore(found: Measurements): number {
      let score = 0;
      for (const [dark, light] of options.orientation) {
        const darkest = found[dark];
        const lightest = found[light];
        if (darkest !== undefined && lightest !== undefined) {
          score += codeLuma(lightest) - codeLuma(darkest);
        }
      }
      return score;
    }

    // Measures in both orientations (upright and rotated by 180°) and takes the one in which the
    // strip patches run from dark to bright; on a tie the previous orientation stays.
    function measure(grid: PixelGrid): void {
      const straight = measureChart(options.layout, uprightCorners.value, grid);
      const flipped = measureChart(
        options.layout,
        turned(uprightCorners.value, options.cardOrder),
        grid,
      );
      const better = orientationScore(flipped) - orientationScore(straight);
      rotated.value = better === 0 ? rotated.value : better > 0;
      measurements.value = rotated.value ? flipped : straight;
      if (options.assessLighting) {
        const input = exposureInput(measurements.value);
        exposure.value = input === null ? null : assessExposure(input);
      }
    }

    return {
      points,
      measurements,
      exposure,
      rotated,
      nextSlot,
      ready,
      corners,
      addCorner,
      moveCorner,
      setCards,
      reset,
      committed,
      beginSearch,
      endSearch,
      restore,
      measure,
    };
  });
}

export const useChartStore = defineChartStore({
  id: 'chart',
  layout: grayLayout,
  cardOrder: GRAY_CARD_ORDER,
  orientation: [
    ['S3-0', 'S3-5'],
    ['S4-0', 'S4-5'],
  ],
  assessLighting: true,
});

export const useColorChartStore = defineChartStore({
  id: 'chart-color',
  layout: colorLayout,
  cardOrder: COLOR_CARD_ORDER,
  // Gray ladder of the color charts: bright at the top (row 1), dark at the bottom (row 6).
  orientation: [
    ['6D', '1D'],
    ['6E', '1E'],
  ],
  assessLighting: false,
});

export type ChartStore = ReturnType<typeof useChartStore>;
