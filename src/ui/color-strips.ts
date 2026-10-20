import type { Measurements } from '../chart/measure';
import { labToSrgb } from '../color/lab';
import type { Vec3 } from '../color/lab';
import type { ReferenceSet } from '../reference/reference';
import { applyColorModel } from '../solve/fit';
import type { ColorModel } from '../solve/fit';

import { cssColor } from './color-css';

// Color of a patch while nothing is measured or computed and there is no reference value either.
export const NEUTRAL_SWATCH = 'rgb(203, 213, 225)';

interface Swatch {
  id: string;
  css: string;
  // From a measurement (or correction) or just a default value?
  measured: boolean;
}

export interface Strips {
  camera: Swatch[];
  corrected: Swatch[];
}

// Default color of a patch: the reference target value, otherwise a neutral gray.
function fallback(reference: ReferenceSet | null, id: string): string {
  const lab = reference?.patches[id];
  return lab === undefined ? NEUTRAL_SWATCH : cssColor(labToSrgb(lab));
}

// Colors of the two layers in the order of the patch IDs: on the left what the camera sees of the
// card, on the right after the correction. Where there is no measurement, the target value is used.
// Without a correction (no model) the right side stays equal to the left so the wipe alone changes nothing.
export function buildStrips(
  ids: readonly string[],
  measurements: Measurements,
  model: ColorModel | null,
  reference: ReferenceSet | null,
): Strips {
  const camera: Swatch[] = [];
  const corrected: Swatch[] = [];
  for (const id of ids) {
    const measured: Vec3 | undefined = measurements[id];
    const standard = fallback(reference, id);
    const seen = measured === undefined ? standard : cssColor(measured);
    camera.push({ id, css: seen, measured: measured !== undefined });
    const fixed = measured !== undefined && model !== null;
    corrected.push({
      id,
      css: fixed ? cssColor(applyColorModel(model, measured)) : seen,
      measured: fixed,
    });
  }
  return { camera, corrected };
}
