import { describe, expect, it } from 'vitest';

import type { ColorModel } from '../solve/fit';

import { cubeSizeText, lutSlices } from './lut-slices';

const identity: ColorModel = {
  curves: [
    { xs: [0, 1], ys: [0, 1] },
    { xs: [0, 1], ys: [0, 1] },
    { xs: [0, 1], ys: [0, 1] },
  ],
  matrix: [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
};

describe('lutSlices', () => {
  it('returns four slices with cells × cells colors each', () => {
    const slices = lutSlices(identity, 4);
    expect(slices).toHaveLength(4);
    for (const slice of slices) {
      expect(slice).toHaveLength(16);
    }
  });

  it('shows black with the blue share at bottom left and yellow at top right for the identity', () => {
    const [first] = lutSlices(identity, 4);
    // Bottom left: red 0, green 0, blue 0.15 (share 38 of 255).
    const bottomLeft = first?.[12] ?? '';
    expect(bottomLeft).toMatch(/^rgb\(0, 0, \d+\)$/);
    // Top right: red 1, green 1.
    expect(first?.[3]).toMatch(/^rgb\(255, 255, \d+\)$/);
  });

  it('passes corrections on: a red cast in the model colors the patches', () => {
    const tinted: ColorModel = {
      ...identity,
      matrix: [
        [1, 0, 0],
        [0.3, 0.7, 0],
        [0, 0, 1],
      ],
    };
    expect(lutSlices(tinted, 2)).not.toEqual(lutSlices(identity, 2));
  });
});

describe('cubeSizeText', () => {
  it('estimates the file size of the three sizes', () => {
    expect(cubeSizeText(17)).toBe('ca. 133 KB');
    expect(cubeSizeText(33)).toBe('ca. 970 KB');
    expect(cubeSizeText(65)).toBe('ca. 7,4 MB');
  });
});
