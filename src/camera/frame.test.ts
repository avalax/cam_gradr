import { describe, expect, it } from 'vitest';

import { averageFrames } from './frame';

function raw(width: number, values: number[]) {
  return { width, height: values.length / 4 / width, data: new Uint8ClampedArray(values) };
}

describe('averageFrames', () => {
  it('mittelt RGB und ignoriert den Alphakanal', () => {
    const a = raw(1, [0, 100, 255, 7]);
    const b = raw(1, [255, 100, 255, 9]);
    const result = averageFrames([a, b]);
    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
    expect([...result.data]).toEqual([
      expect.closeTo(0.5, 6),
      expect.closeTo(100 / 255, 6),
      expect.closeTo(1, 6),
    ]);
  });

  it('verarbeitet mehrere Pixel', () => {
    const frame = raw(2, [255, 0, 0, 255, 0, 255, 0, 255]);
    expect([...averageFrames([frame]).data]).toEqual([1, 0, 0, 0, 1, 0]);
  });

  it('wertet fehlende Daten als 0', () => {
    const short = { width: 1, height: 1, data: [] };
    expect([...averageFrames([short]).data]).toEqual([0, 0, 0]);
  });

  it('lehnt eine leere Liste ab', () => {
    expect(() => averageFrames([])).toThrow('Mindestens ein Frame');
  });

  it('lehnt unterschiedliche Größen ab', () => {
    expect(() => averageFrames([raw(1, [0, 0, 0, 0]), raw(2, [0, 0, 0, 0, 0, 0, 0, 0])])).toThrow(
      'gleiche Größe',
    );
  });
});
