import { describe, expect, it } from 'vitest';

import type { Frame } from '../camera/frame';

import { homographyFromCorners } from './homography';
import { median, samplePatch } from './sample';

const identity = homographyFromCorners([
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
]);

const RED = [0.8, 0.4, 0.2];
const BLUE = [0, 0, 1];

// 100x100 image: left half red, right half blue.
function frame(): Frame {
  const data = new Float32Array(100 * 100 * 3);
  for (let y = 0; y < 100; y++) {
    for (let x = 0; x < 100; x++) {
      data.set(x < 50 ? RED : BLUE, (y * 100 + x) * 3);
    }
  }
  return { width: 100, height: 100, data };
}

describe('samplePatch', () => {
  it('returns the median in the patch', () => {
    const rgb = samplePatch(frame(), identity, { x: 0.1, y: 0.1, w: 0.3, h: 0.3 });
    expect(rgb?.[0]).toBeCloseTo(0.8, 6);
    expect(rgb?.[1]).toBeCloseTo(0.4, 6);
    expect(rgb?.[2]).toBeCloseTo(0.2, 6);
  });

  it('ignores outliers at the edge (median in the inner area)', () => {
    const image = frame();
    // bright pixel near the patch corner outside the inner area
    image.data[(11 * 100 + 11) * 3] = 1;
    const rgb = samplePatch(image, identity, { x: 0.1, y: 0.1, w: 0.3, h: 0.3 });
    expect(rgb?.[0]).toBeCloseTo(0.8, 6);
  });

  it('returns null when the patch lies outside the image', () => {
    const outside = homographyFromCorners([
      { x: 500, y: 500 },
      { x: 600, y: 500 },
      { x: 600, y: 600 },
      { x: 500, y: 600 },
    ]);
    expect(samplePatch(frame(), outside, { x: 0, y: 0, w: 1, h: 1 })).toBeNull();
  });
});

describe('median', () => {
  it('takes the middle value of an odd number and the mean of the two middle ones otherwise', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});
