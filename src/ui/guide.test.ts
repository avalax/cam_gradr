import { describe, expect, it } from 'vitest';

import type { Corners } from '../chart/types';

import { guideCorners } from './guide';

describe('guideCorners', () => {
  it('places two portrait frames left and right, centered in the image', () => {
    const [left, right] = guideCorners({ width: 1280, height: 720 }, 2) as [Corners, Corners];
    const width = left[1].x - left[0].x;
    expect(left[0].y).toBeCloseTo(208.8);
    expect(left[2].y).toBeCloseTo(511.2);
    expect(width).toBeCloseTo(190.5, 0);
    // Centered as a group: the middle between the card centers is the middle of the image.
    const middle = (left[0].x + width / 2 + right[0].x + width / 2) / 2;
    expect(middle).toBeCloseTo(640);
    expect(right[0].x - left[0].x).toBeCloseTo(width * 1.26);
  });

  it('returns corners clockwise starting at top left', () => {
    const [[a, b, c, d]] = guideCorners({ width: 100, height: 100 }, 2) as [Corners, Corners];
    expect(b.x).toBeGreaterThan(a.x);
    expect(b.y).toBe(a.y);
    expect(c.y).toBeGreaterThan(b.y);
    expect(d.x).toBe(a.x);
  });

  it('places a single card in the middle of the image', () => {
    const [only] = guideCorners({ width: 200, height: 100 }, 1) as [Corners];
    expect(only[0].x + (only[1].x - only[0].x) / 2).toBeCloseTo(100);
  });
});
