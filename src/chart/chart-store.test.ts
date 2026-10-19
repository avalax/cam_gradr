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

  describe('Suche mit gehaltenem Stand', () => {
    function withCards() {
      const store = useChartStore();
      placeCard(store, 0);
      placeCard(store, 200);
      store.measure(grid(200, 200));
      return store;
    }

    it('hält beim Beginn der Suche Eckpunkte und Messwerte und leert den sichtbaren Stand', () => {
      const store = withCards();
      store.beginSearch();
      expect(store.points).toEqual({});
      expect(store.measurements).toEqual({});
      expect(store.exposure).toBeNull();
      expect(Object.keys(store.committed().points)).toHaveLength(2);
      expect(Object.keys(store.committed().measurements).length).toBeGreaterThan(0);
    });

    it('stellt am Ende der Suche den bisherigen Stand wieder her, wenn nichts Neues entstand', () => {
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

    it('behält neue Eckpunkte und lässt den gehaltenen Stand fallen', () => {
      const store = withCards();
      store.beginSearch();
      store.setCards([
        [point(1, 1), point(2, 1), point(2, 2), point(1, 2)],
        [point(3, 1), point(4, 1), point(4, 2), point(3, 2)],
      ]);
      store.endSearch();
      expect(store.points[3]?.[0]).toEqual(point(1, 1));
    });

    it('beginnt keine Suche ohne Eckpunkte und hält bei einem zweiten Beginn den ersten Stand', () => {
      const store = useChartStore();
      store.beginSearch();
      expect(store.committed().points).toEqual({});
      const filled = withCards();
      filled.beginSearch();
      filled.beginSearch();
      filled.endSearch();
      expect(Object.keys(filled.points)).toHaveLength(2);
    });

    it('verwirft den gehaltenen Stand mit reset und restore', () => {
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

  it('misst bei den Farbkarten nur die Felder, ohne Raumhelligkeit zu bewerten', () => {
    const store = useColorChartStore();
    expect(store.nextSlot).toEqual({ card: 1, index: 0 });
    placeCard(store, 0);
    placeCard(store, 100);
    store.measure(grid(188, 118));
    expect(Object.keys(store.measurements)).toContain('3A');
    expect(Object.keys(store.measurements)).toContain('3E');
    expect(store.exposure).toBeNull();
  });

  it('hat ohne vollständige Messung kein Ergebnis', () => {
    const store = useChartStore();
    store.measure(grid(100, 100));
    expect(store.exposure).toBeNull();
  });

  it('stellt gespeicherte Eckpunkte und Messwerte wieder her und bewertet das Licht neu', () => {
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

  it('übernimmt bei den Farbkarten Messwerte ohne Helligkeitsbewertung', () => {
    const store = useColorChartStore();
    store.restore({
      points: { 1: [point(2, 2)] },
      measurements: { '3A': [0.1, 0.2, 0.3] },
      rotated: false,
    });
    expect(store.measurements).toEqual({ '3A': [0.1, 0.2, 0.3] });
    expect(store.exposure).toBeNull();
  });

  it('übernimmt die erkannten Karten von links nach rechts', () => {
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

  // Zwei Karten nebeneinander (je 100 Pixel breit); die Streifenfelder laufen von oben nach unten
  // dunkel→hell (aufrecht) oder hell→dunkel (um 180° gedreht gehalten).
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

  it('lässt aufrecht gehaltene Karten unverändert', () => {
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

  it('erkennt um 180° gedrehte Karten und ordnet die Felder neu zu', () => {
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
    // Die linke Karte im Bild ist nun Karte 4 (auf dem Kopf): ihre oben-links-Ecke liegt unten rechts.
    expect(store.corners[4]?.[0]).toEqual(point(100, 100));
    expect(store.corners[3]?.[0]).toEqual(point(200, 100));
  });

  it('wechselt mit dem Bild zurück, wenn die Karten wieder aufrecht gehalten werden', () => {
    const store = useChartStore();
    placeCard(store, 0);
    placeCard(store, 100);
    store.measure(stripGrid(false));
    store.measure(stripGrid(true));
    expect(store.rotated).toBe(false);
  });

  it('behält die bisherige Lage, wenn die Messung keine Aussage erlaubt', () => {
    const store = useChartStore();
    placeCard(store, 0);
    placeCard(store, 100);
    store.measure(stripGrid(false));
    store.measure(grid(100, 100));
    expect(store.rotated).toBe(true);
  });

  it('dreht die Zuordnung nur, wenn beide Karten gesetzt sind', () => {
    const store = useChartStore();
    store.restore({
      points: { 3: [point(0, 0), point(1, 0), point(1, 1), point(0, 1)] },
      measurements: {},
      rotated: true,
    });
    expect(store.corners[3]).toEqual([point(0, 0), point(1, 0), point(1, 1), point(0, 1)]);
  });

  it('merkt sich die Drehung beim Wiederherstellen und setzt sie beim Zurücksetzen zurück', () => {
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

  // Farbkarten nebeneinander (je 100 Pixel breit): Karte 1 links, Karte 2 rechts, oder um 180° gedreht
  // (Karte 2 links, Karte 1 rechts, beide auf dem Kopf). Die Grauleiter (Zeilen 1–6 der Spalten D und E)
  // läuft aufrecht von oben hell nach unten dunkel.
  function colorGrid(rotated: boolean): PixelGrid {
    const data = new Uint8ClampedArray(200 * 100 * 4).fill(255);
    const paint = (x: number, y: number, level: number) => {
      const value = Math.round(level * 255);
      data.set([value, value, value, 255], (y * 200 + x) * 4);
    };
    for (const card of colorLayout.cards) {
      const slot = (card.card === 1) === rotated ? 1 : 0;
      for (const patch of card.patches) {
        const row = Number(patch.id.at(0));
        const level = patch.role === 'neutral' ? (7 - row) / 7 : 0.4;
        const { x, y, w, h } = patch.rect;
        const [left, top] = rotated ? [1 - x - w, 1 - y - h] : [x, y];
        for (let py = Math.round(top * 100); py < Math.round((top + h) * 100); py++) {
          for (let px = Math.round(left * 100); px < Math.round((left + w) * 100); px++) {
            paint(slot * 100 + px, py, level);
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

  it('lässt aufrecht gehaltene Farbkarten unverändert', () => {
    const store = useColorChartStore();
    placeBoth(store);
    store.measure(colorGrid(false));
    expect(store.rotated).toBe(false);
    expect(Number(store.measurements['1D']?.[0])).toBeGreaterThan(
      Number(store.measurements['6D']?.[0]),
    );
  });

  it('erkennt um 180° gedrehte Farbkarten an der Grauleiter und ordnet die Felder neu zu', () => {
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
    // Die Grauleiter liefert wieder den Sollverlauf: Zeile 1 hell (6/7), Zeile 6 dunkel (1/7).
    expect(Number(store.measurements['1D']?.[0])).toBeCloseTo(6 / 7, 1);
    expect(Number(store.measurements['6E']?.[0])).toBeCloseTo(1 / 7, 1);
  });
});
