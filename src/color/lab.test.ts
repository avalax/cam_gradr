import Color from 'colorjs.io';
import { describe, expect, it } from 'vitest';

import {
  deltaE2000,
  labToLinearSrgb,
  labToSrgb,
  linearSrgbToXyzD50,
  srgbToLab,
  xyzD50ToLab,
} from './lab';
import type { Vec3 } from './lab';

// Deterministic pseudo-random values so that the tests stay reproducible.
function sequence(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
}

function referenceDelta(a: Vec3, b: Vec3): number {
  return new Color('lab', [...a]).deltaE(new Color('lab', [...b]), '2000');
}

describe('deltaE2000', () => {
  // Test data from Sharma, Wu, Dalal (2005): (Lab1, Lab2, expected ΔE00).
  it.each([
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
    [[50, -1.3802, -84.2814], [50, 0, -82.7485], 1],
    [[50, 0, 0], [50, -1, 2], 2.3669],
    [[50, 2.49, -0.001], [50, -2.49, 0.0009], 7.1792],
    [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
  ] as const)('matches the literature values (%#)', (first, second, expected) => {
    expect(deltaE2000(first, second)).toBeCloseTo(expected, 3);
  });

  it('is 0 for equal colors and symmetric', () => {
    expect(deltaE2000([40, 10, -20], [40, 10, -20])).toBe(0);
    const a: Vec3 = [30, 40, 10];
    const b: Vec3 = [70, -20, 60];
    expect(deltaE2000(a, b)).toBeCloseTo(deltaE2000(b, a), 10);
  });

  it('treats neutral colors as having no hue', () => {
    expect(deltaE2000([50, 0, 0], [60, 0, 0])).toBeGreaterThan(0);
  });

  it('matches colorjs.io for random color pairs', () => {
    const next = sequence(42);
    for (let index = 0; index < 300; index++) {
      const a: Vec3 = [next() * 100, next() * 200 - 100, next() * 200 - 100];
      const b: Vec3 = [next() * 100, next() * 200 - 100, next() * 200 - 100];
      expect(deltaE2000(a, b)).toBeCloseTo(referenceDelta(a, b), 6);
    }
  });
});

describe('Lab-Umrechnung', () => {
  it('matches colorjs.io (Lab, D50) for sRGB colors', () => {
    const next = sequence(7);
    for (let index = 0; index < 100; index++) {
      const code: Vec3 = [next(), next(), next()];
      const expected = new Color('srgb', [...code]).to('lab').coords;
      const actual = srgbToLab(code);
      for (const channel of [0, 1, 2] as const) {
        expect(actual[channel]).toBeCloseTo(expected[channel] ?? 0, 1);
      }
    }
  });

  it('maps white to L = 100 and black to L = 0', () => {
    expect(srgbToLab([1, 1, 1])[0]).toBeCloseTo(100, 2);
    expect(srgbToLab([0, 0, 0])[0]).toBeCloseTo(0, 6);
    const white = srgbToLab([1, 1, 1]);
    expect(white[1]).toBeCloseTo(0, 1);
    expect(white[2]).toBeCloseTo(0, 1);
  });

  it('is invertible (sRGB -> Lab -> sRGB), also in the dark range', () => {
    const next = sequence(99);
    for (let index = 0; index < 100; index++) {
      const code: Vec3 = [next(), next() * 0.02, next()];
      const back = labToSrgb(srgbToLab(code));
      for (const channel of [0, 1, 2] as const) {
        expect(back[channel]).toBeCloseTo(code[channel], 4);
      }
    }
  });

  it('clamps colors outside sRGB to 0..1', () => {
    const [r, g, b] = labToSrgb([50, 120, 120]);
    for (const value of [r, g, b]) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('returns the linear sRGB value without clamping', () => {
    const [r, g, b] = labToLinearSrgb(srgbToLab([0.5, 0.5, 0.5]));
    expect(r).toBeCloseTo(0.214_04, 3);
    expect(g).toBeCloseTo(0.214_04, 3);
    expect(b).toBeCloseTo(0.214_04, 3);
  });

  it('converts XYZ near black via the linear branch', () => {
    const lab = xyzD50ToLab(linearSrgbToXyzD50([0.001, 0.001, 0.001]));
    expect(lab[0]).toBeCloseTo(0.903, 1);
  });
});
