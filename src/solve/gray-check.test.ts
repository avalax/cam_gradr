import { describe, expect, it } from 'vitest';

import { grayLayout, NEUTRAL_IDS } from '../chart/layouts';
import type { Rgb } from '../chart/types';
import { dummyIds, dummyLab } from '../test-support/dummy-reference';
import { cameraCode } from '../test-support/synthetic-camera';

import { fitColorModel } from './fit';
import { checkGrayCards } from './gray-check';

const reference = {
  name: 'Test',
  patches: Object.fromEntries(dummyIds().map((id) => [id, dummyLab(id)])),
};
const measurements = Object.fromEntries(
  dummyIds().map((id): [string, Rgb] => [id, cameraCode(dummyLab(id))]),
);
const { model } = fitColorModel({ measurements, reference, neutralIds: NEUTRAL_IDS });

describe('checkGrayCards', () => {
  it('vergleicht die großen Graufelder vor und nach der Korrektur mit dem Nennwert', () => {
    const gray: Record<string, Rgb> = {
      G50: cameraCode([76.07, 0, 0]),
      G18: cameraCode([49.5, 0, 0]),
      'S3-0': [0.1, 0.1, 0.1],
    };
    const checks = checkGrayCards(model, gray, grayLayout);
    expect(checks.map((check) => check.id)).toEqual(['G50', 'G18']);
    for (const check of checks) {
      expect(check.after).toBeLessThan(check.before);
      expect(check.after).toBeLessThan(1.5);
    }
  });

  it('übergeht Felder ohne Messung', () => {
    expect(checkGrayCards(model, { G50: cameraCode([76.07, 0, 0]) }, grayLayout)).toHaveLength(1);
    expect(checkGrayCards(model, {}, grayLayout)).toEqual([]);
  });
});
