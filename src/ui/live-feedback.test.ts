import { describe, expect, it } from 'vitest';

import type { Corners } from '../chart/types';

import { cardSizeShare } from './live-feedback';

const TOP = 10;

function card(x: number, height: number): Corners {
  return [
    { x, y: TOP },
    { x: x + height / 2, y: TOP },
    { x: x + height / 2, y: TOP + height },
    { x, y: TOP + height },
  ];
}

describe('cardSizeShare', () => {
  it('is the mean card height as a fraction of the image height', () => {
    expect(cardSizeShare([card(10, 100), card(80, 140)], 600)).toBeCloseTo(0.2);
  });

  it('is zero without cards', () => {
    expect(cardSizeShare([], 600)).toBe(0);
  });
});
