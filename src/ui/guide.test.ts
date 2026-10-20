import { describe, expect, it } from 'vitest';

import type { Corners } from '../chart/types';

import { guideCorners } from './guide';

describe('guideCorners', () => {
  it('places two portrait frames left and right, centered in the image', () => {
    const [left, right] = guideCorners({ width: 1280, height: 720 }, 2) as [Corners, Corners];
    const width = left[1].x - left[0].x;
    expect(left[0].y).toBeCloseTo(68.4);
    expect(left[2].y).toBeCloseTo(651.6);
    expect(width).toBeCloseTo(367.4, 0);
    expect(left[0].x + width / 2).toBeCloseTo(435.2);
    expect(right[0].x + width / 2).toBeCloseTo(896);
  });

  it('returns corners clockwise starting at top left', () => {
    const [[a, b, c, d]] = guideCorners({ width: 100, height: 100 }, 2) as [Corners, Corners];
    expect(b.x).toBeGreaterThan(a.x);
    expect(b.y).toBe(a.y);
    expect(c.y).toBeGreaterThan(b.y);
    expect(d.x).toBe(a.x);
  });

  it('places a single card on the left of the image', () => {
    expect(guideCorners({ width: 200, height: 100 }, 1)).toHaveLength(1);
  });
});
