import { describe, expect, it } from 'vitest';

import { coloredShare, isExpectedKind } from './card-kind';
import type { Rgb } from './types';

const gray = (level: number): Rgb => [level, level, level];

describe('coloredShare', () => {
  it('counts the colored fields, not the gray ones', () => {
    const fields = {
      a: [0.8, 0.2, 0.2] as Rgb,
      b: gray(0.5),
      c: [0.62, 0.6, 0.57] as Rgb,
      d: gray(0.3),
    };
    expect(coloredShare(fields)).toBeCloseTo(0.25);
  });

  it('ignores fields that are too dark to tell, and is 0 without fields', () => {
    expect(coloredShare({ a: [0.2, 0.01, 0.01] })).toBe(0);
    expect(coloredShare({})).toBe(0);
  });
});

describe('isExpectedKind', () => {
  it('accepts gray cards in the gray step and color cards in the color step', () => {
    expect(isExpectedKind('neutral', 0.02)).toBe(true);
    expect(isExpectedKind('colorful', 0.6)).toBe(true);
  });

  it('rejects the other kind', () => {
    expect(isExpectedKind('neutral', 0.6)).toBe(false);
    expect(isExpectedKind('colorful', 0.02)).toBe(false);
  });
});

describe('coloredShare with a color cast', () => {
  const cast = (rgb: Rgb): Rgb => [rgb[0] * 0.8, rgb[1] * 0.9, rgb[2] * 1.25];

  it('does not take gray cards under a strong bluish cast for colorful', () => {
    const fields = Object.fromEntries(
      [0.15, 0.3, 0.45, 0.6, 0.75, 0.9].map((level, index) => [String(index), cast(gray(level))]),
    );
    expect(coloredShare(fields)).toBe(0);
  });

  it('still finds the colored fields of color cards under the cast', () => {
    const fields = {
      a: cast([0.8, 0.2, 0.2]),
      b: cast([0.2, 0.7, 0.2]),
      c: cast([0.2, 0.2, 0.8]),
      d: cast(gray(0.5)),
    };
    expect(coloredShare(fields)).toBeCloseTo(0.75);
  });

  it('ignores the tinted black level of the camera', () => {
    const fields = {
      a: [0.07, 0.05, 0.21] as Rgb,
      b: [0.04, 0.02, 0.14] as Rgb,
      c: [0.33, 0.39, 0.55] as Rgb,
      d: [0.5, 0.58, 0.8] as Rgb,
      e: [0.7, 0.8, 1] as Rgb,
    };
    expect(coloredShare(fields)).toBe(0);
  });

  it('copes with fields without any light', () => {
    expect(coloredShare({ a: [0, 0, 0], b: [0, 0, 0] })).toBe(0);
  });
});
