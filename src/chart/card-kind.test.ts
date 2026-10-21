import { describe, expect, it } from 'vitest';

import { looksLike } from './card-kind';
import type { Rgb } from './types';

const gray = (level: number): Rgb => [level, level, level];

describe('looksLike', () => {
  const grays = { a: gray(0.2), b: gray(0.5), c: [0.62, 0.6, 0.57] as Rgb };
  const colors = { a: [0.8, 0.2, 0.2] as Rgb, b: [0.2, 0.7, 0.3] as Rgb, c: gray(0.5) };

  it('accepts gray fields (also with a mild color cast) as gray cards', () => {
    expect(looksLike('neutral', grays)).toBe(true);
  });

  it('rejects colored fields as gray cards', () => {
    expect(looksLike('neutral', colors)).toBe(false);
  });

  it('accepts colored fields as color cards', () => {
    expect(looksLike('colorful', colors)).toBe(true);
  });

  it('rejects gray fields as color cards', () => {
    expect(looksLike('colorful', grays)).toBe(false);
  });

  it('ignores fields that are too dark to tell and does not object without measurements', () => {
    expect(looksLike('neutral', { a: [0.09, 0.01, 0.01] })).toBe(true);
    expect(looksLike('neutral', {})).toBe(true);
    expect(looksLike('colorful', {})).toBe(true);
  });
});
