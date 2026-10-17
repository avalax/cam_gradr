import { describe, expect, it } from 'vitest';

import { NEUTRAL_IDS } from '../chart/layouts';
import type { Rgb } from '../chart/types';
import { deltaE2000, srgbToLab } from '../color/lab';
import type { Vec3 } from '../color/lab';
import { applyColorModel, fitColorModel } from '../solve/fit';
import { dummyIds, dummyLab } from '../test-support/dummy-reference';
import { cameraCode } from '../test-support/synthetic-camera';

import { blendLut, buildLut, identityLut, sampleLut } from './lut';

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
  it('hat size³ Einträge in Würfelreihenfolge (R am schnellsten)', () => {
    const lut = identityLut(3);
    expect(lut.size).toBe(3);
    expect(lut.data).toHaveLength(27 * 3);
    expect([...lut.data.slice(0, 6)]).toEqual([0, 0, 0, 0.5, 0, 0]);
    expect(node(lut, 0, 1, 0)).toEqual([0, 0.5, 0]);
    expect(node(lut, 0, 0, 2)).toEqual([0, 0, 1]);
    expect(node(lut, 2, 2, 2)).toEqual([1, 1, 1]);
  });

  it('lehnt ungültige Größen ab', () => {
    for (const size of [1, 0, -3, 2.5, 130, NaN]) {
      expect(() => identityLut(size)).toThrow('LUT-Größe');
    }
  });
});

describe('buildLut', () => {
  const lut = buildLut(model, 17);

  it('enthält an den Gitterpunkten genau die Werte des Modells', () => {
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

  it('hält alle Werte im Bereich 0 bis 1', () => {
    for (const value of lut.data) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('bildet Schwarz und Weiß annähernd auf sich selbst ab', () => {
    const [br, bg, bb] = node(lut, 0, 0, 0);
    expect(br + bg + bb).toBeLessThan(0.05);
    const [wr, wg, wb] = node(lut, 16, 16, 16);
    expect(wr).toBeGreaterThan(0.95);
    expect(wg).toBeGreaterThan(0.95);
    expect(wb).toBeGreaterThan(0.95);
  });

  it('macht bei 33 Stützstellen die Verfälschung der künstlichen Kamera rückgängig', () => {
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
  it('liefert bei der Identitäts-LUT den Eingabewert (trilinear exakt)', () => {
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

  it('begrenzt Eingaben außerhalb von 0..1', () => {
    const lut = identityLut(4);
    expect(sampleLut(lut, [-1, 2, 0.5])).toEqual([0, 1, expect.closeTo(0.5, 6)]);
  });

  it('trifft Gitterpunkte exakt, auch am oberen Rand', () => {
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
    // Nur der Punkt (1,0,0) hat Rot 1: die Mitte der Kante liegt bei 0,5.
    lut.data[3] = 1;
    expect(sampleLut(lut, [0.5, 0, 0])[0]).toBeCloseTo(0.5, 6);
  });
});

describe('blendLut', () => {
  const lut = buildLut(model, 9);

  it('liefert bei Stärke 0 die Identität und bei 1 die Korrektur', () => {
    const none = blendLut(lut, 0);
    const identity = identityLut(9);
    expect([...none.data]).toEqual([...identity.data]);
    expect([...blendLut(lut, 1).data]).toEqual([...lut.data]);
  });

  it('mischt dazwischen und begrenzt die Stärke auf 0..1', () => {
    const half = blendLut(lut, 0.5);
    const identity = identityLut(9);
    for (const index of [30, 100, 500]) {
      expect(half.data[index]).toBeCloseTo(
        (Number(identity.data[index]) + Number(lut.data[index])) / 2,
        6,
      );
    }
    expect([...blendLut(lut, -2).data]).toEqual([...identity.data]);
    expect([...blendLut(lut, 5).data]).toEqual([...lut.data]);
  });
});
