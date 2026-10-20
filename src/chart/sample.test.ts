import { describe, expect, it } from 'vitest';

import { homographyFromCorners } from './homography';
import { samplePatch } from './sample';
import type { PixelGrid } from './types';

const identity = homographyFromCorners([
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
]);

// 100x100 image (RGBA): left half red (200,100,50), right half blue; one bright outlier.
function grid(): PixelGrid {
  const data = new Uint8ClampedArray(100 * 100 * 4);
  for (let y = 0; y < 100; y++) {
    for (let x = 0; x < 100; x++) {
      const offset = (y * 100 + x) * 4;
      const left = x < 50;
      data[offset] = left ? 200 : 0;
      data[offset + 1] = left ? 100 : 0;
      data[offset + 2] = left ? 50 : 255;
      data[offset + 3] = 255;
    }
  }
  return { width: 100, height: 100, data, channels: 4, maxValue: 255 };
}

describe('samplePatch', () => {
  it('returns the median in the patch, normalized to 0..1', () => {
    const rgb = samplePatch(grid(), identity, { x: 0.1, y: 0.1, w: 0.3, h: 0.3 });
    expect(rgb?.[0]).toBeCloseTo(200 / 255, 6);
    expect(rgb?.[1]).toBeCloseTo(100 / 255, 6);
    expect(rgb?.[2]).toBeCloseTo(50 / 255, 6);
  });

  it('ignores outliers at the edge (median in the inner area)', () => {
    const image = grid();
    // bright pixel near the patch corner outside the inner area
    const offset = (11 * 100 + 11) * 4;
    image.data = Uint8ClampedArray.from(image.data);
    (image.data as Uint8ClampedArray)[offset] = 255;
    const rgb = samplePatch(image, identity, { x: 0.1, y: 0.1, w: 0.3, h: 0.3 });
    expect(rgb?.[0]).toBeCloseTo(200 / 255, 6);
  });

  it('uses the mean of the two middle values for an even number of values', () => {
    // Patch across the color boundary: equally many sample points per half
    const rgb = samplePatch(grid(), identity, { x: 0.3, y: 0.1, w: 0.4, h: 0.3 }, 1, 2);
    expect(rgb?.[0]).toBeCloseTo((200 / 255 + 0) / 2, 6);
  });

  it('uses the middle value for an odd number of values', () => {
    const rgb = samplePatch(grid(), identity, { x: 0.1, y: 0.1, w: 0.3, h: 0.3 }, 1, 3);
    expect(rgb?.[0]).toBeCloseTo(200 / 255, 6);
  });

  it('scales with maxValue and copes with RGB float data', () => {
    const data = new Float32Array(2 * 2 * 3).fill(0.25);
    const rgb = samplePatch(
      { width: 2, height: 2, data, channels: 3, maxValue: 1 },
      homographyFromCorners([
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 2 },
        { x: 0, y: 2 },
      ]),
      { x: 0, y: 0, w: 1, h: 1 },
    );
    expect(rgb).toEqual([0.25, 0.25, 0.25]);
  });

  it('returns null when the patch lies outside the image', () => {
    const outside = homographyFromCorners([
      { x: 500, y: 500 },
      { x: 600, y: 500 },
      { x: 600, y: 600 },
      { x: 500, y: 600 },
    ]);
    expect(samplePatch(grid(), outside, { x: 0, y: 0, w: 1, h: 1 })).toBeNull();
  });

  it('treats missing pixel data as 0', () => {
    const rgb = samplePatch(
      { width: 100, height: 100, data: [], channels: 4, maxValue: 255 },
      identity,
      { x: 0.1, y: 0.1, w: 0.3, h: 0.3 },
    );
    expect(rgb).toEqual([0, 0, 0]);
  });
});
