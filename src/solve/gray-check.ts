import { grayLayout } from '../chart/layouts';
import type { Measurements } from '../chart/measure';
import type { Rgb } from '../chart/types';
import { deltaE2000, srgbToLab } from '../color/lab';
import type { Vec3 } from '../color/lab';

import { applyColorModel, targetLab } from './fit';
import type { ColorModel } from './fit';

export interface GrayCheck {
  id: string;
  before: number;
  after: number;
}

function check(
  model: ColorModel,
  id: string,
  nominalLab: Vec3,
  measured: Rgb,
  exposureGain: number,
): GrayCheck {
  // Like the color patches, the nominal value is taken as the correction aims at it, at the exposure of
  // the shot: the correction keeps that exposure, so a slightly brighter or darker shot is no error.
  const nominal = targetLab(nominalLab, exposureGain);
  const corrected = srgbToLab(applyColorModel(model, measured));
  return {
    id,
    before: deltaE2000(srgbToLab(measured), nominal),
    after: deltaE2000(corrected, nominal),
  };
}

// Check with the gray cards: the large patches (with nominal value) do not enter the calculation.
// How far they deviate from the nominal value before and after the correction independently shows
// whether the tone curve is also right where it was not fitted (or whether the light changed
// between the shots). `exposureGain` is the exposure of the color shot (from the fit report).
export function checkGrayCards(
  model: ColorModel,
  measurements: Measurements,
  exposureGain: number,
): GrayCheck[] {
  return grayLayout.cards.flatMap((card) =>
    card.patches.flatMap((patch) => {
      const measured = measurements[patch.id];
      return measured === undefined || patch.nominalLab === undefined
        ? []
        : [check(model, patch.id, patch.nominalLab, measured, exposureGain)];
    }),
  );
}
