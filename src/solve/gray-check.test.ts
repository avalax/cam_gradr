import { describe, expect, it } from 'vitest';

import { grayLayout, NEUTRAL_IDS } from '../chart/layouts';
import type { Rgb } from '../chart/types';
import { labToLinearSrgb, linearSrgbToXyzD50, xyzD50ToLab } from '../color/lab';
import type { Vec3 } from '../color/lab';
import { dummyIds, dummyLab } from '../test-support/dummy-reference';
import { cameraCode } from '../test-support/synthetic-camera';

import { fitColorModel } from './fit';
import { checkGrayCards } from './gray-check';

const reference = {
  name: 'Test',
  patches: Object.fromEntries(dummyIds().map((id) => [id, dummyLab(id)])),
};

// The same color at a different exposure (its linear light times `exposure`).
function exposed(lab: Vec3, exposure: number): Vec3 {
  const [r, g, b] = labToLinearSrgb(lab);
  return xyzD50ToLab(linearSrgbToXyzD50([r * exposure, g * exposure, b * exposure]));
}

// Color cards and gray cards, both shot at the same exposure (1 = as bright as the reference).
function shots(exposure: number) {
  const camera = (lab: Vec3): Rgb => cameraCode(exposed(lab, exposure));
  const measurements = Object.fromEntries(
    dummyIds().map((id): [string, Rgb] => [id, camera(dummyLab(id))]),
  );
  const fit = fitColorModel({ measurements, reference, neutralIds: NEUTRAL_IDS });
  const gray: Record<string, Rgb> = {
    G50: camera([76.07, 0, 0]),
    G18: camera([49.5, 0, 0]),
    'S3-0': [0.1, 0.1, 0.1],
  };
  return { fit, gray };
}

describe('checkGrayCards', () => {
  const { fit, gray } = shots(1);
  const { model } = fit;
  const gain = fit.report.exposureGain;

  it('compares the large gray patches with the nominal value before and after correction', () => {
    const checks = checkGrayCards(model, gray, grayLayout, gain);
    expect(checks.map((check) => check.id)).toEqual(['G50', 'G18']);
    for (const check of checks) {
      expect(check.after).toBeLessThan(check.before);
      expect(check.after).toBeLessThan(1.5);
    }
  });

  it('measures at the exposure of the shot: equally darker or brighter shots are no error', () => {
    for (const exposure of [0.8, 1.3]) {
      const shot = shots(exposure);
      const checks = checkGrayCards(
        shot.fit.model,
        shot.gray,
        grayLayout,
        shot.fit.report.exposureGain,
      );
      for (const check of checks) {
        expect(check.after).toBeLessThan(1.5);
      }
      // Against the nominal value at the reference's exposure the same shot would look wrong.
      const absolute = checkGrayCards(shot.fit.model, shot.gray, grayLayout, 1);
      expect(Math.max(...absolute.map((check) => check.after))).toBeGreaterThan(3);
    }
  });

  it('skips patches without a measurement', () => {
    expect(checkGrayCards(model, { G50: gray.G50 ?? [0, 0, 0] }, grayLayout, gain)).toHaveLength(1);
    expect(checkGrayCards(model, {}, grayLayout, gain)).toEqual([]);
  });
});
