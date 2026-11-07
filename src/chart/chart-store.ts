import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';

import type { Frame } from '../camera/frame';

import { coloredShare, isExpectedKind } from './card-kind';
import type { CardKind } from './card-kind';
import { sortCorners } from './corner-order';
import { assessExposure, codeLuma } from './exposure';
import type { ExposureResult } from './exposure';
import { grayLayout, colorLayout } from './layouts';
import { measureChart, exposureInput } from './measure';
import type { Measurements } from './measure';
import type { ChartLayout, Corners, Point } from './types';

const CORNERS_PER_CARD = 4;

interface ChartStoreOptions {
  id: string;
  // Its cards from left to right: gray cards 50 % then 18 %, color cards columns A–D then E–H.
  layout: ChartLayout;
  // Pairs (darkest, brightest patch) of a chart: they let the app detect whether the charts are
  // held rotated by 180° (the dark patch is then at the bottom instead of the top).
  orientation: readonly (readonly [string, string])[];
  // Which cards the step expects; other cards are noticed from the colors of their fields.
  kind: CardKind;
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
  const cardOrder = options.layout.cards.map((card) => card.card);
  return defineStore(options.id, () => {
    const points = ref<Record<number, Point[]>>({});
    const measurements = shallowRef<Measurements>({});
    const exposure = shallowRef<ExposureResult | null>(null);
    // The cards in the image are of the expected kind (not color cards in the gray step or the other way round).
    const plausible = ref(true);
    // Charts are rotated by 180° (detected from the measurements).
    const rotated = ref(false);
    // While the camera searches for new charts, the previous state (corners and measurements for
    // the still image) is kept here. If no new state results, the previous one comes back.
    const held = shallowRef<ChartState | null>(null);

    function placed(card: number): Point[] {
      return points.value[card] ?? [];
    }

    // All cards have their corners.
    const ready = computed(() =>
      cardOrder.every((card) => placed(card).length === CORNERS_PER_CARD),
    );

    const uprightCorners = computed<CornerMap>(() => {
      const result: CornerMap = {};
      for (const card of cardOrder) {
        const [a, b, c, d] = placed(card);
        if (a !== undefined && b !== undefined && c !== undefined && d !== undefined) {
          // Dragged corners can change places: they are sorted again.
          result[card] = sortCorners([a, b, c, d]);
        }
      }
      return result;
    });

    const corners = computed<CornerMap>(() =>
      rotated.value ? turned(uprightCorners.value, cardOrder) : uprightCorners.value,
    );

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
        cardOrder.map((card, index) => [card, [...(found[index] ?? [])]]),
      );
    }

    function clear(): void {
      points.value = {};
      measurements.value = {};
      exposure.value = null;
      rotated.value = false;
      plausible.value = true;
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

    // How clearly the patches of the orientation pairs run from dark to bright (positive) or the
    // other way round (negative).
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

    // Which kind of cards is in the image? Judged by measuring the fields of the color cards at the
    // corners (color cards are colorful there, gray cards are not), in both orientations.
    function expectedKind(frame: Frame): boolean {
      const upright = uprightCorners.value;
      if (Object.keys(upright).length === 0) {
        return true;
      }
      const [first = -1, second = -1] = cardOrder;
      const share = (found: CornerMap): number =>
        coloredShare(measureChart(colorLayout, { 1: found[first], 2: found[second] }, frame));
      const best = Math.max(share(upright), share(turned(upright, cardOrder)));
      return isExpectedKind(options.kind, best);
    }

    // Measures the patches in the still image (for the gray cards also the room brightness), in
    // both orientations (upright and rotated by 180°), and takes the one in which the strip patches
    // run from dark to bright; on a tie the previous orientation stays.
    function measure(frame: Frame): void {
      plausible.value = expectedKind(frame);
      const straight = measureChart(options.layout, uprightCorners.value, frame);
      const flipped = measureChart(options.layout, turned(uprightCorners.value, cardOrder), frame);
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
      plausible,
      rotated,
      ready,
      corners,
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
  kind: 'neutral',
  orientation: [
    ['S3-0', 'S3-5'],
    ['S4-0', 'S4-5'],
  ],
  assessLighting: true,
});

export const useColorChartStore = defineChartStore({
  id: 'chart-color',
  layout: colorLayout,
  kind: 'colorful',
  // Gray ladder of the color charts: bright at the top (row 1), dark at the bottom (row 6).
  orientation: [
    ['6D', '1D'],
    ['6E', '1E'],
  ],
  assessLighting: false,
});

export type ChartStore = ReturnType<typeof useChartStore>;
