import { describe, expect, it } from 'vitest';

import { NEUTRAL_IDS } from '../chart/layouts';
import type { Rgb } from '../chart/types';
import { deltaE2000, srgbToLab } from '../color/lab';
import type { Vec3 } from '../color/lab';
import { applyColorModel, fitColorModel } from '../solve/fit';
import { dummyIds, dummyLab } from '../test-support/dummy-reference';
import { cameraCode } from '../test-support/synthetic-camera';

import { buildLut, identityLut, sampleLut } from './lut';

const reference = {
  name: 'Test',
  patches: Object.fromEntries(dummyIds().map((id) => [id, dummyLab(id)])),
};
const measurements: Record<string, Rgb> = Object.fromEntries(
  dummyIds().map((id) => [id, cameraCode(dummyLab(id))]),
);
const { model } = fitColorModel({ measurements, reference, neutralIds: NEUTRAL_IDS });

function node(lut: { size: number; data: Float32Array }, r: number, g: number, b: number): Vec3 {
  const offset = (b * lut.size * lut.size + g * lut.size + r) * 3;
  return [Number(lut.data[offset]), Number(lut.data[offset + 1]), Number(lut.data[offset + 2])];
}

describe('identityLut', () => {
  it('has size³ entries in cube order (R fastest)', () => {
    const lut = identityLut(3);
    expect(lut.size).toBe(3);
    expect(lut.data).toHaveLength(27 * 3);
    expect([...lut.data.slice(0, 6)]).toEqual([0, 0, 0, 0.5, 0, 0]);
    expect(node(lut, 0, 1, 0)).toEqual([0, 0.5, 0]);
    expect(node(lut, 0, 0, 2)).toEqual([0, 0, 1]);
    expect(node(lut, 2, 2, 2)).toEqual([1, 1, 1]);
  });

  it('rejects invalid sizes', () => {
    for (const size of [1, 0, -3, 2.5, 130, NaN]) {
      expect(() => identityLut(size)).toThrow('The LUT size');
    }
  });
});

describe('buildLut', () => {
  const lut = buildLut(model, 17);

  it('contains exactly the model values at the grid points', () => {
    for (const [r, g, b] of [
      [0, 0, 0],
      [16, 16, 16],
      [3, 9, 12],
      [8, 8, 8],
      [16, 0, 5],
    ] as const) {
      const expected = applyColorModel(model, [r / 16, g / 16, b / 16]);
      const actual = node(lut, r, g, b);
      for (const channel of [0, 1, 2] as const) {
        expect(actual[channel]).toBeCloseTo(expected[channel], 5);
      }
    }
  });

  it('keeps all values in the range 0 to 1', () => {
    for (const value of lut.data) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('maps black and white approximately to themselves', () => {
    const [br, bg, bb] = node(lut, 0, 0, 0);
    expect(br + bg + bb).toBeLessThan(0.05);
    const [wr, wg, wb] = node(lut, 16, 16, 16);
    expect(wr).toBeGreaterThan(0.95);
    expect(wg).toBeGreaterThan(0.95);
    expect(wb).toBeGreaterThan(0.95);
  });

  it('undoes the distortion of the artificial camera with 33 grid points', () => {
    const fine = buildLut(model, 33);
    const errors: number[] = [];
    for (const id of dummyIds()) {
      const lab = dummyLab(id);
      const corrected = sampleLut(fine, cameraCode(lab));
      errors.push(deltaE2000(srgbToLab(corrected), lab));
    }
    const mean = errors.reduce((sum, value) => sum + value, 0) / errors.length;
    expect(mean).toBeLessThan(1.5);
  });
});

describe('sampleLut', () => {
  it('returns the input value for the identity LUT (trilinear exact)', () => {
    const lut = identityLut(5);
    for (const rgb of [
      [0, 0, 0],
      [1, 1, 1],
      [0.13, 0.57, 0.91],
      [0.5, 0.25, 0.75],
    ] as const) {
      const out = sampleLut(lut, rgb);
      for (const channel of [0, 1, 2] as const) {
        expect(out[channel]).toBeCloseTo(rgb[channel], 6);
      }
    }
  });

  it('clamps inputs outside 0..1', () => {
    const lut = identityLut(4);
    expect(sampleLut(lut, [-1, 2, 0.5])).toEqual([0, 1, expect.closeTo(0.5, 6)]);
  });

  it('hits grid points exactly, also at the upper edge', () => {
    const lut = buildLut(model, 9);
    const out = sampleLut(lut, [1, 1, 1]);
    const expected = node(lut, 8, 8, 8);
    for (const channel of [0, 1, 2] as const) {
      expect(out[channel]).toBeCloseTo(expected[channel], 6);
    }
  });

  it('interpoliert zwischen Gitterpunkten', () => {
    const lut = identityLut(2);
    lut.data.fill(0);
    lut.data[0] = 0;
    // Only the point (1,0,0) has red 1: the middle of the edge is at 0.5.
    lut.data[3] = 1;
    expect(sampleLut(lut, [0.5, 0, 0])[0]).toBeCloseTo(0.5, 6);
  });
});
