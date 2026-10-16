import { describe, expect, it } from 'vitest';

import { exposureInput, measureChart } from './measure';
import type { ChartLayout, Corners, PixelGrid, Rgb } from './types';

const layout: ChartLayout = {
  cards: [
    { card: 3, patches: [{ id: 'G50', rect: { x: 0.1, y: 0.1, w: 0.4, h: 0.4 } }] },
    { card: 4, patches: [{ id: 'G18', rect: { x: 0.1, y: 0.1, w: 0.4, h: 0.4 } }] },
  ],
};

// 200x100-Bild: linke Hälfte hell (Karte 3), rechte Hälfte dunkel (Karte 4).
const grid: PixelGrid = (() => {
  const data = new Uint8ClampedArray(200 * 100 * 4);
  for (let y = 0; y < 100; y++) {
    for (let x = 0; x < 200; x++) {
      const value = x < 100 ? 200 : 100;
      const offset = (y * 200 + x) * 4;
      data.set([value, value, value, 255], offset);
    }
  }
  return { width: 200, height: 100, data, channels: 4, maxValue: 255 };
})();

const cardAt = (x: number): Corners => [
  { x, y: 0 },
  { x: x + 100, y: 0 },
  { x: x + 100, y: 100 },
  { x, y: 100 },
];

describe('measureChart', () => {
  it('misst nur Karten mit gesetzten Eckpunkten', () => {
    const result = measureChart(layout, { 3: cardAt(0) }, grid);
    expect(Object.keys(result)).toEqual(['G50']);
    expect(result.G50?.[0]).toBeCloseTo(200 / 255, 6);
  });

  it('misst beide Karten', () => {
    const result = measureChart(layout, { 3: cardAt(0), 4: cardAt(100) }, grid);
    expect(result.G18?.[0]).toBeCloseTo(100 / 255, 6);
  });

  it('lässt Felder außerhalb des Bildes aus', () => {
    const result = measureChart(layout, { 3: cardAt(1000) }, grid);
    expect(result).toEqual({});
  });
});

describe('exposureInput', () => {
  const g = (value: number): Rgb => [value, value, value];
  const full = {
    G18: g(0.4),
    G50: g(0.7),
    'S3-0': g(0.1),
    'S4-0': g(0.05),
    'S3-5': g(0.8),
    'S4-5': g(0.9),
  };

  it('wählt dunkelstes und hellstes Streifenfeld beider Karten', () => {
    const result = exposureInput(full);
    expect(result?.stripDark).toEqual(g(0.05));
    expect(result?.stripLight).toEqual(g(0.9));
    expect(result?.large18).toEqual(g(0.4));
    expect(result?.large50).toEqual(g(0.7));
  });

  it('kommt auch mit nur einer Karte zurecht', () => {
    const { 'S4-0': _a, 'S4-5': _b, ...single } = full;
    expect(exposureInput(single)?.stripLight).toEqual(g(0.8));
  });

  it('liefert null, wenn Felder fehlen', () => {
    expect(exposureInput({})).toBeNull();
    const { G18: _g18, ...withoutG18 } = full;
    expect(exposureInput(withoutG18)).toBeNull();
    const { G50: _g50, ...withoutG50 } = full;
    expect(exposureInput(withoutG50)).toBeNull();
    const { 'S3-0': _d3, 'S4-0': _d4, ...withoutDark } = full;
    expect(exposureInput(withoutDark)).toBeNull();
    const { 'S3-5': _l3, 'S4-5': _l4, ...withoutLight } = full;
    expect(exposureInput(withoutLight)).toBeNull();
  });
});
