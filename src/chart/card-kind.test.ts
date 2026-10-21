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
    expect(coloredShare({ a: [0.09, 0.01, 0.01] })).toBe(0);
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
