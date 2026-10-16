import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { CORNERS_PER_CARD, GRAY_CARD_ORDER, grayLayout, useChartStore } from './chart-store';
import type { PixelGrid } from './types';

const point = (x: number, y: number) => ({ x, y });

function placeCard(store: ReturnType<typeof useChartStore>, x: number) {
  store.addCorner(point(x, 0));
  store.addCorner(point(x + 100, 0));
  store.addCorner(point(x + 100, 100));
  store.addCorner(point(x, 100));
}

// 200x100-Bild: Karte 3 links, Karte 4 rechts; Feldhelligkeit pro Karte vorgegeben.
function grid(left: number, right: number): PixelGrid {
  const data = new Uint8ClampedArray(200 * 100 * 4);
  for (let y = 0; y < 100; y++) {
    for (let x = 0; x < 200; x++) {
      data.set(
        [x < 100 ? left : right, x < 100 ? left : right, x < 100 ? left : right, 255],
        (y * 200 + x) * 4,
      );
    }
  }
  return { width: 200, height: 100, data, channels: 4, maxValue: 255 };
}

describe('useChartStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('lädt das Graulayout mit beiden Karten', () => {
    expect(grayLayout.cards.map((card) => card.card)).toEqual([...GRAY_CARD_ORDER]);
  });

  it('verlangt die Eckpunkte in fester Reihenfolge', () => {
    const store = useChartStore();
    expect(store.nextSlot).toEqual({ card: 3, index: 0 });
    store.addCorner(point(1, 1));
    expect(store.nextSlot).toEqual({ card: 3, index: 1 });
    for (let i = 1; i < CORNERS_PER_CARD; i++) {
      store.addCorner(point(i, i));
    }
    expect(store.nextSlot).toEqual({ card: 4, index: 0 });
    expect(store.ready).toBe(false);
  });

  it('ist bereit, wenn alle 8 Eckpunkte gesetzt sind, und ignoriert weitere', () => {
    const store = useChartStore();
    placeCard(store, 0);
    placeCard(store, 100);
    expect(store.ready).toBe(true);
    expect(store.nextSlot).toBeNull();
    store.addCorner(point(5, 5));
    expect(store.points[3]).toHaveLength(4);
    expect(store.points[4]).toHaveLength(4);
    expect(Object.keys(store.corners)).toEqual(['3', '4']);
  });

  it('ordnet die Eckpunkte unabhängig von der Klickreihenfolge', () => {
    const store = useChartStore();
    // Klickreihenfolge: oben links, unten links, unten rechts, oben rechts.
    store.addCorner(point(0, 0));
    store.addCorner(point(0, 100));
    store.addCorner(point(100, 100));
    store.addCorner(point(100, 0));
    expect(store.corners[3]).toEqual([point(0, 0), point(100, 0), point(100, 100), point(0, 100)]);
    expect(store.points[3]?.[1]).toEqual(point(0, 100));
  });

  it('liefert Eckpunkte erst für vollständige Karten', () => {
    const store = useChartStore();
    store.addCorner(point(1, 1));
    expect(store.corners).toEqual({});
  });

  it('verschiebt vorhandene Eckpunkte und ignoriert ungesetzte', () => {
    const store = useChartStore();
    store.addCorner(point(1, 1));
    store.moveCorner(3, 0, point(9, 9));
    expect(store.points[3]).toEqual([point(9, 9)]);
    store.moveCorner(3, 2, point(5, 5));
    store.moveCorner(4, 0, point(5, 5));
    expect(store.points[3]).toEqual([point(9, 9)]);
    expect(store.points[4]).toBeUndefined();
  });

  it('verschiebt nur den gewählten Eckpunkt', () => {
    const store = useChartStore();
    store.addCorner(point(1, 1));
    store.addCorner(point(2, 2));
    store.moveCorner(3, 1, point(7, 7));
    expect(store.points[3]).toEqual([point(1, 1), point(7, 7)]);
  });

  it('misst und bewertet die Belichtung', () => {
    const store = useChartStore();
    placeCard(store, 0);
    placeCard(store, 100);
    store.measure(grid(188, 118));
    expect(Object.keys(store.measurements).toSorted((a, b) => a.localeCompare(b))).toContain('G18');
    expect(store.exposure).not.toBeNull();
  });

  it('hat ohne vollständige Messung kein Ergebnis', () => {
    const store = useChartStore();
    store.measure(grid(100, 100));
    expect(store.exposure).toBeNull();
  });

  it('setzt alles zurück', () => {
    const store = useChartStore();
    placeCard(store, 0);
    placeCard(store, 100);
    store.measure(grid(188, 118));
    store.reset();
    expect(store.points).toEqual({});
    expect(store.measurements).toEqual({});
    expect(store.exposure).toBeNull();
    expect(store.ready).toBe(false);
  });
});
