import { describe, expect, it } from 'vitest';

import { sortCorners } from './corner-order';
import type { Corners, Point } from './types';

// Perspective-distorted quadrilateral: top left, top right, bottom right, bottom left.
const expected: Corners = [
  { x: 100, y: 50 },
  { x: 420, y: 80 },
  { x: 380, y: 400 },
  { x: 60, y: 350 },
];

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) {
    return [[...items]];
  }
  return items.flatMap((item, index) =>
    permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [
      item,
      ...rest,
    ]),
  );
}

describe('sortCorners', () => {
  it('leaves an already correct order unchanged', () => {
    expect(sortCorners(expected)).toEqual(expected);
  });

  it('detects the corners for all 24 click orders', () => {
    const all = permutations([...expected]);
    expect(all).toHaveLength(24);
    for (const order of all) {
      expect(sortCorners(order as unknown as [Point, Point, Point, Point])).toEqual(expected);
    }
  });

  it('fixes the swapped order top left, bottom left, bottom right, top right', () => {
    const [tl, tr, br, bl] = expected;
    expect(sortCorners([tl, bl, br, tr])).toEqual(expected);
  });
});
