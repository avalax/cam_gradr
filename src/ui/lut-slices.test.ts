import { describe, expect, it } from 'vitest';

import type { ColorModel } from '../solve/fit';
import { parseLookCube } from '../look/look';
import { INVERT_CUBE } from '../test-support/look-cubes';
import { IDENTITY_MODEL } from '../test-support/identity-model';

import { cssColor } from './color-css';
import { cubeSizeText, lutSlices } from './lut-slices';

const identity = IDENTITY_MODEL;

const invert = parseLookCube('Invert.cube', INVERT_CUBE);

describe('lutSlices', () => {
  it('shows the look over the correction at its strength', () => {
    const [plain] = lutSlices(identity, 2);
    const [full] = lutSlices(identity, 2, { lut: invert, amount: 1 });
    const [none] = lutSlices(identity, 2, { lut: invert, amount: 0 });
    expect(none).toEqual(plain);
    expect(full).not.toEqual(plain);
    // Top left is green at a blue fraction of 1/16; inverted it turns magenta.
    expect(full?.[0]).toBe(cssColor([1, 0, 1 - 1 / 16]));
  });

  it('returns eight slices with cells × cells colors each', () => {
    const slices = lutSlices(identity, 4);
    expect(slices).toHaveLength(8);
    for (const slice of slices) {
      expect(slice).toHaveLength(16);
    }
  });

  it('shows black with the blue share at bottom left and yellow at top right for the identity', () => {
    const [first] = lutSlices(identity, 4);
    // Bottom left: red 0, green 0, blue 1/16 (share 16 of 255).
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
    expect(cubeSizeText(17)).toBe('ca.\u{A0}133\u{A0}KB');
    expect(cubeSizeText(33)).toBe('ca.\u{A0}970\u{A0}KB');
    expect(cubeSizeText(65)).toBe('ca.\u{A0}7,4\u{A0}MB');
  });
});
