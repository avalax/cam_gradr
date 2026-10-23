import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  CORNERS_PER_CARD,
  GRAY_CARD_ORDER,
  useChartStore,
  useColorChartStore,
} from './chart-store';
import { colorLayout, grayLayout } from './layouts';
import type { Corners, PixelGrid } from './types';

const point = (x: number, y: number) => ({ x, y });

function placeCard(store: ReturnType<typeof useChartStore>, x: number) {
  store.addCorner(point(x, 0));
  store.addCorner(point(x + 100, 0));
  store.addCorner(point(x + 100, 100));
  store.addCorner(point(x, 100));
}

// 200x100 image: chart 3 left, chart 4 right; patch brightness given per chart.
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

  describe('search with held state', () => {
    function withCards() {
      const store = useChartStore();
      placeCard(store, 0);
      placeCard(store, 200);
      store.measure(grid(200, 200));
      return store;
    }

    it('holds corners and measurements when the search starts and clears the visible state', () => {
      const store = withCards();
      store.beginSearch();
      expect(store.points).toEqual({});
      expect(store.measurements).toEqual({});
      expect(store.exposure).toBeNull();
      expect(Object.keys(store.committed().points)).toHaveLength(2);
      expect(Object.keys(store.committed().measurements).length).toBeGreaterThan(0);
    });

    it('restores the previous state at the end of the search if nothing new arose', () => {
      const store = withCards();
      const before = store.committed();
      const exposureBefore = store.exposure;
      store.beginSearch();
      store.endSearch();
      expect(store.points).toEqual(before.points);
      expect(store.measurements).toEqual(before.measurements);
      expect(store.exposure).toEqual(exposureBefore);
      expect(store.committed().points).toEqual(before.points);
    });

    it('keeps new corners and drops the held state', () => {
      const store = withCards();
      store.beginSearch();
      store.setCards([
        [point(1, 1), point(2, 1), point(2, 2), point(1, 2)],
        [point(3, 1), point(4, 1), point(4, 2), point(3, 2)],
      ]);
      store.endSearch();
      expect(store.points[3]?.[0]).toEqual(point(1, 1));
    });

    it('starts no search without corners and keeps the first state on a second start', () => {
      const store = useChartStore();
      store.beginSearch();
      expect(store.committed().points).toEqual({});
      const filled = withCards();
      filled.beginSearch();
      filled.beginSearch();
      filled.endSearch();
      expect(Object.keys(filled.points)).toHaveLength(2);
    });

    it('discards the held state with reset and restore', () => {
      const store = withCards();
      store.beginSearch();
      store.reset();
      store.endSearch();
      expect(store.points).toEqual({});

      const again = withCards();
      again.beginSearch();
      again.restore({ points: {}, measurements: {}, rotated: false });
      again.endSearch();
      expect(again.points).toEqual({});
    });
  });

  it('loads the gray layout with both cards', () => {
    expect(grayLayout.cards.map((card) => card.card)).toEqual([...GRAY_CARD_ORDER]);
  });

  it('requires the corners in a fixed order', () => {
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

  it('is ready when all 8 corners are set, and ignores further ones', () => {
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

  it('orders the corners regardless of the click order', () => {
    const store = useChartStore();
    // Click order: top left, bottom left, bottom right, top right.
    store.addCorner(point(0, 0));
    store.addCorner(point(0, 100));
    store.addCorner(point(100, 100));
    store.addCorner(point(100, 0));
    expect(store.corners[3]).toEqual([point(0, 0), point(100, 0), point(100, 100), point(0, 100)]);
    expect(store.points[3]?.[1]).toEqual(point(0, 100));
  });

  it('returns corners only for complete charts', () => {
    const store = useChartStore();
    store.addCorner(point(1, 1));
    expect(store.corners).toEqual({});
  });

  it('moves existing corners and ignores unset ones', () => {
    const store = useChartStore();
    store.addCorner(point(1, 1));
    store.moveCorner(3, 0, point(9, 9));
    expect(store.points[3]).toEqual([point(9, 9)]);
    store.moveCorner(3, 2, point(5, 5));
    store.moveCorner(4, 0, point(5, 5));
    expect(store.points[3]).toEqual([point(9, 9)]);
    expect(store.points[4]).toBeUndefined();
  });

  it('moves only the selected corner', () => {
    const store = useChartStore();
    store.addCorner(point(1, 1));
    store.addCorner(point(2, 2));
    store.moveCorner(3, 1, point(7, 7));
    expect(store.points[3]).toEqual([point(1, 1), point(7, 7)]);
  });

  it('measures and rates the exposure', () => {
    const store = useChartStore();
    placeCard(store, 0);
    placeCard(store, 100);
    store.measure(grid(188, 118));
    expect(Object.keys(store.measurements).toSorted((a, b) => a.localeCompare(b))).toContain('G18');
    expect(store.exposure).not.toBeNull();
  });

  it('measures only the patches for the color charts, without rating room brightness', () => {
    const store = useColorChartStore();
    expect(store.nextSlot).toEqual({ card: 1, index: 0 });
    placeCard(store, 0);
    placeCard(store, 100);
    store.measure(grid(188, 118));
    expect(Object.keys(store.measurements)).toContain('3A');
    expect(Object.keys(store.measurements)).toContain('3E');
    expect(store.exposure).toBeNull();
  });

  it('has no result without a complete measurement', () => {
    const store = useChartStore();
    store.measure(grid(100, 100));
    expect(store.exposure).toBeNull();
  });

  it('restores saved corners and measurements and rates the light again', () => {
    const store = useChartStore();
    const measured: Record<string, [number, number, number]> = {
      G18: [0.46, 0.46, 0.46],
      G50: [0.74, 0.74, 0.74],
      'S3-0': [0.1, 0.1, 0.1],
      'S3-5': [0.85, 0.85, 0.85],
    };
    store.restore({ points: { 3: [point(1, 1)] }, measurements: measured, rotated: false });
    expect(store.points[3]).toEqual([point(1, 1)]);
    expect(store.measurements).toEqual(measured);
    expect(store.exposure?.verdict).toBe('ok');
    store.restore({ points: {}, measurements: {}, rotated: false });
    expect(store.exposure).toBeNull();
  });

  it('adopts measurements for the color charts without brightness rating', () => {
    const store = useColorChartStore();
    store.restore({
      points: { 1: [point(2, 2)] },
      measurements: { '3A': [0.1, 0.2, 0.3] },
      rotated: false,
    });
    expect(store.measurements).toEqual({ '3A': [0.1, 0.2, 0.3] });
    expect(store.exposure).toBeNull();
  });

  it('adopts the detected charts from left to right', () => {
    const store = useChartStore();
    const card = (x: number): Corners => [
      point(x, 0),
      point(x + 100, 0),
      point(x + 100, 100),
      point(x, 100),
    ];
    store.setCards([card(0), card(100)]);
    expect(store.points[3]).toEqual(card(0));
    expect(store.points[4]).toEqual(card(100));
    expect(store.ready).toBe(true);
    store.setCards([card(50)]);
    expect(store.points[4]).toEqual([]);
    expect(store.ready).toBe(false);
  });

  it('resets everything', () => {
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

  // Two charts side by side (100 pixels wide each); the strip patches run from top to bottom
  // dark→bright (upright) or bright→dark (held rotated by 180°).
  function stripGrid(upright: boolean): PixelGrid {
    const data = new Uint8ClampedArray(200 * 100 * 4);
    for (let y = 0; y < 100; y++) {
      for (let x = 0; x < 200; x++) {
        const inLeftStrip = x >= 72 && x < 95;
        const inRightStrip = x >= 106 && x < 124;
        const level = inLeftStrip || inRightStrip ? (upright ? y : 100 - y) / 100 : 0.3;
        const value = Math.round(level * 255);
        data.set([value, value, value, 255], (y * 200 + x) * 4);
      }
    }
    return { width: 200, height: 100, data, channels: 4, maxValue: 255 };
  }

  it('leaves upright charts unchanged', () => {
    const store = useChartStore();
    placeCard(store, 0);
    placeCard(store, 100);
    store.measure(stripGrid(true));
    expect(store.rotated).toBe(false);
    expect(Number(store.measurements['S3-0']?.[0])).toBeLessThan(
      Number(store.measurements['S3-5']?.[0]),
    );
    expect(Number(store.measurements['S4-0']?.[0])).toBeLessThan(
      Number(store.measurements['S4-5']?.[0]),
    );
  });

  it('detects charts rotated by 180° and reassigns the patches', () => {
    const store = useChartStore();
    placeCard(store, 0);
    placeCard(store, 100);
    store.measure(stripGrid(false));
    expect(store.rotated).toBe(true);
    expect(Number(store.measurements['S3-0']?.[0])).toBeLessThan(
      Number(store.measurements['S3-5']?.[0]),
    );
    expect(Number(store.measurements['S4-0']?.[0])).toBeLessThan(
      Number(store.measurements['S4-5']?.[0]),
    );
    // The left chart in the image is now chart 4 (upside down): its top-left corner is at the
    // bottom right.
    expect(store.corners[4]?.[0]).toEqual(point(100, 100));
    expect(store.corners[3]?.[0]).toEqual(point(200, 100));
  });

  it('switches back with the image when the charts are held upright again', () => {
    const store = useChartStore();
    placeCard(store, 0);
    placeCard(store, 100);
    store.measure(stripGrid(false));
    store.measure(stripGrid(true));
    expect(store.rotated).toBe(false);
  });

  it('keeps the previous orientation when the measurement allows no conclusion', () => {
    const store = useChartStore();
    placeCard(store, 0);
    placeCard(store, 100);
    store.measure(stripGrid(false));
    store.measure(grid(100, 100));
    expect(store.rotated).toBe(true);
  });

  it('rotates the assignment only when both charts are set', () => {
    const store = useChartStore();
    store.restore({
      points: { 3: [point(0, 0), point(1, 0), point(1, 1), point(0, 1)] },
      measurements: {},
      rotated: true,
    });
    expect(store.corners[3]).toEqual([point(0, 0), point(1, 0), point(1, 1), point(0, 1)]);
  });

  it('remembers the rotation on restore and resets it on reset', () => {
    const store = useColorChartStore();
    store.restore({ points: {}, measurements: {}, rotated: true });
    expect(store.rotated).toBe(true);
    store.reset();
    expect(store.rotated).toBe(false);
  });
});

describe('Farbkarten um 180° gedreht', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  // Color charts side by side (100 pixels wide each): chart 1 left, chart 2 right, or rotated by
  // 180° (chart 2 left, chart 1 right, both upside down). The gray ladder (rows 1–6 of columns D
  // and E) runs upright from bright at the top to dark at the bottom.
  function colorGrid(rotated: boolean): PixelGrid {
    const data = new Uint8ClampedArray(200 * 100 * 4).fill(255);
    // Colored fields are red, green or blue; the gray ladder is neutral.
    const hues = [
      [204, 77, 77, 255],
      [77, 204, 77, 255],
      [77, 77, 204, 255],
    ];
    const paint = (x: number, y: number, level: number, hue: number | null) => {
      const value = Math.round(level * 255);
      data.set(
        hue === null ? [value, value, value, 255] : (hues[hue % 3] ?? []),
        (y * 200 + x) * 4,
      );
    };
    for (const card of colorLayout.cards) {
      const slot = (card.card === 1) === rotated ? 1 : 0;
      for (const [index, patch] of card.patches.entries()) {
        const row = Number(patch.id.at(0));
        const level = patch.role === 'neutral' ? (7 - row) / 7 : 0.4;
        const { x, y, w, h } = patch.rect;
        const [left, top] = rotated ? [1 - x - w, 1 - y - h] : [x, y];
        for (let py = Math.round(top * 100); py < Math.round((top + h) * 100); py++) {
          for (let px = Math.round(left * 100); px < Math.round((left + w) * 100); px++) {
            paint(slot * 100 + px, py, level, patch.role === 'neutral' ? null : index);
          }
        }
      }
    }
    return { width: 200, height: 100, data, channels: 4, maxValue: 255 };
  }

  function placeBoth(store: ReturnType<typeof useColorChartStore>) {
    for (const x of [0, 100]) {
      store.addCorner(point(x, 0));
      store.addCorner(point(x + 100, 0));
      store.addCorner(point(x + 100, 100));
      store.addCorner(point(x, 100));
    }
  }

  it('recognizes color charts as such, upright or rotated, but not gray cards in their place', () => {
    const color = useColorChartStore();
    for (const rotated of [false, true]) {
      placeBoth(color);
      color.measure(colorGrid(rotated));
      expect(color.plausible).toBe(true);
      color.reset();
    }
    const gray = useChartStore();
    placeCard(gray, 0);
    placeCard(gray, 100);
    gray.measure(grid(150, 90));
    expect(gray.plausible).toBe(true);
    gray.reset();
    placeCard(gray, 0);
    placeCard(gray, 100);
    gray.measure(colorGrid(false));
    expect(gray.plausible).toBe(false);
    placeBoth(color);
    color.measure(grid(150, 90));
    expect(color.plausible).toBe(false);
  });

  it('leaves upright color charts unchanged', () => {
    const store = useColorChartStore();
    placeBoth(store);
    store.measure(colorGrid(false));
    expect(store.rotated).toBe(false);
    expect(Number(store.measurements['1D']?.[0])).toBeGreaterThan(
      Number(store.measurements['6D']?.[0]),
    );
  });

  it('detects color charts rotated by 180° from the gray ladder and reassigns the patches', () => {
    const store = useColorChartStore();
    placeBoth(store);
    store.measure(colorGrid(true));
    expect(store.rotated).toBe(true);
    expect(Number(store.measurements['1D']?.[0])).toBeGreaterThan(
      Number(store.measurements['6D']?.[0]),
    );
    expect(Number(store.measurements['1E']?.[0])).toBeGreaterThan(
      Number(store.measurements['6E']?.[0]),
    );
    // The gray ladder gives the target progression again: row 1 bright (6/7), row 6 dark (1/7).
    expect(Number(store.measurements['1D']?.[0])).toBeCloseTo(6 / 7, 1);
    expect(Number(store.measurements['6E']?.[0])).toBeCloseTo(1 / 7, 1);
  });
});
