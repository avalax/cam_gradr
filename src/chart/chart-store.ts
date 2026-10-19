import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';

import { sortCorners } from './corner-order';
import { assessExposure, codeLuma } from './exposure';
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
  // Paare (dunkelstes, hellstes Feld) einer Karte: an ihnen erkennt die App, ob die Karten um 180°
  // gedreht gehalten werden (dann liegt das dunkle Feld unten statt oben).
  orientation: readonly (readonly [string, string])[];
  // Nur die Graukarten bewerten zusätzlich die Raumhelligkeit.
  assessLighting: boolean;
}

// Dreht die Ecken einer Karte um 180°: aus oben links wird unten rechts usw.
function halfTurn([a, b, c, d]: Corners): Corners {
  return [c, d, a, b];
}

type CornerMap = Record<number, Corners | undefined>;

// Eckpunkte und Messwerte einer Kartengruppe.
interface ChartState {
  points: Record<number, Point[]>;
  measurements: Measurements;
  rotated: boolean;
}

// Karten um 180° gedreht: Die linke Karte im Bild ist dann die rechte Karte des Layouts und umgekehrt,
// jeweils auf dem Kopf.
function turned(upright: CornerMap, order: readonly number[]): CornerMap {
  const [first = -1, second = -1] = order;
  const left = upright[first];
  const right = upright[second];
  return left === undefined || right === undefined
    ? upright
    : { ...upright, [first]: halfTurn(right), [second]: halfTurn(left) };
}

// Zustand für eine Kartengruppe (Karten, Eckpunkte, Messwerte); eine Instanz je Schritt.
function defineChartStore(options: ChartStoreOptions) {
  return defineStore(options.id, () => {
    const points = ref<Record<number, Point[]>>({});
    const measurements = shallowRef<Measurements>({});
    const exposure = shallowRef<ExposureResult | null>(null);
    // Karten sind um 180° gedreht (aus den Messwerten erkannt).
    const rotated = ref(false);
    // Während die Kamera nach neuen Karten sucht, bleibt der bisherige Stand (Eckpunkte und Messwerte
    // zum Standbild) hier erhalten. Kommt kein neuer Stand zustande, kehrt der bisherige zurück.
    const held = shallowRef<ChartState | null>(null);

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

    const uprightCorners = computed<CornerMap>(() => {
      const result: CornerMap = {};
      for (const card of options.cardOrder) {
        const [a, b, c, d] = placed(card);
        if (a !== undefined && b !== undefined && c !== undefined && d !== undefined) {
          // Die Reihenfolge der Klicks ist egal: die Ecken werden selbst einsortiert.
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

    // Setzt die Ecken aller Karten auf einmal (automatische Erkennung), von links nach rechts.
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

    // Verwirft den Stand ganz, auch den gehaltenen.
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

    // Der gültige Stand: während der Suche der gehaltene, sonst der aktuelle (zum Speichern im Projekt).
    function committed(): ChartState {
      return held.value ?? current();
    }

    // Die Kamera beginnt zu suchen: Der bisherige Stand wird gehalten, die Eckpunkte verschwinden, damit
    // ein neues Standbild mit neuen Eckpunkten entstehen kann.
    function beginSearch(): void {
      if (held.value === null && Object.keys(points.value).length > 0) {
        held.value = current();
        clear();
      }
    }

    // Die Suche endet: Ohne neue Eckpunkte gilt wieder der bisherige Stand.
    function endSearch(): void {
      const previous = held.value;
      held.value = null;
      if (previous !== null && Object.keys(points.value).length === 0) {
        restore(previous);
      }
    }

    // Stellt gespeicherte Eckpunkte und Messwerte wieder her (Projekt laden).
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

    // Misst die Felder im aktuellen Bild (bei den Graukarten zusätzlich die Raumhelligkeit).
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

    // Misst in beiden Lagen (aufrecht und um 180° gedreht) und nimmt die, in der die Streifenfelder von
    // dunkel nach hell laufen; bei Gleichstand bleibt die bisherige Lage.
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
  // Grauleiter der Farbkarten: oben (Zeile 1) hell, unten (Zeile 6) dunkel.
  orientation: [
    ['6D', '1D'],
    ['6E', '1E'],
  ],
  assessLighting: false,
});

export type ChartStore = ReturnType<typeof useChartStore>;
