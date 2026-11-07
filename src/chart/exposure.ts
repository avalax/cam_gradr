import { luminanceOf } from '../color/lab';
import { linearToSrgb, srgbToLinear } from '../color/srgb';

import type { Rgb } from './types';

interface ExposureConfig {
  // From this value (0..1) of one of its channels the brightest strip patch counts as clipped: the
  // top of the range, a little below 1 because the still is averaged. The strip patch is about as
  // bright as a white; at the target exposure it reads about 0.95, which is fine.
  highlightClip: number;
  // Up to this value (0..1) of one of its channels the darkest strip patch counts as crushed: the
  // bottom of the range, where the channel no longer carries a signal.
  shadowFloor: number;
  // Target brightness (sRGB-encoded, 0..1) of the large patches: 18 % reflectance ≈ 0.46,
  // 50 % ≈ 0.74.
  target18: number;
  target50: number;
  // Allowed mean deviation of the large patches from the target value.
  tolerance: number;
  // Allowed deviation of the distance between the two large patches from the target distance.
  contrastTolerance: number;
}

export const DEFAULT_EXPOSURE_CONFIG: ExposureConfig = {
  highlightClip: 0.99,
  shadowFloor: 0.01,
  target18: 0.46,
  target50: 0.74,
  tolerance: 0.06,
  contrastTolerance: 0.05,
};

export interface ExposureInput {
  large18: Rgb;
  large50: Rgb;
  stripDark: Rgb;
  stripLight: Rgb;
}

type Verdict = 'too-dark' | 'ok' | 'too-bright' | 'high-contrast' | 'low-contrast';

export interface ExposureResult {
  verdict: Verdict;
  highlightsClipped: boolean;
  shadowsCrushed: boolean;
  level18: number;
  level50: number;
  // Mean deviation of the large patches from the target value (positive = too bright).
  delta: number;
  // Deviation of the distance between the 50 % and the 18 % patch from the target distance
  // (positive = too much contrast, negative = too flat).
  contrast: number;
}

// Brightness of an sRGB-encoded color value (Rec.709 luminance, sRGB-encoded again).
export function codeLuma([r, g, b]: Rgb): number {
  return linearToSrgb(luminanceOf([srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)]));
}

function pickVerdict(
  clipped: boolean,
  crushed: boolean,
  delta: number,
  tolerance: number,
): Verdict {
  if (clipped && crushed) {
    return 'high-contrast';
  }
  if (clipped) {
    return 'too-bright';
  }
  if (crushed) {
    return 'too-dark';
  }
  if (delta > tolerance) {
    return 'too-bright';
  }
  return delta < -tolerance ? 'too-dark' : 'ok';
}

// With the brightness right, the contrast decides: the shot is only ok within the normal range of
// both axes of the measuring field.
function contrastVerdict(verdict: Verdict, contrast: number, tolerance: number): Verdict {
  if (verdict !== 'ok' || Math.abs(contrast) <= tolerance) {
    return verdict;
  }
  return contrast > 0 ? 'high-contrast' : 'low-contrast';
}

export function assessExposure(input: ExposureInput): ExposureResult {
  const { highlightClip, shadowFloor, target18, target50, tolerance, contrastTolerance } =
    DEFAULT_EXPOSURE_CONFIG;
  const level18 = codeLuma(input.large18);
  const level50 = codeLuma(input.large50);
  const delta = (level18 - target18 + (level50 - target50)) / 2;
  const contrast = level50 - level18 - (target50 - target18);
  const highlightsClipped = Math.max(...input.stripLight) >= highlightClip;
  const shadowsCrushed = Math.min(...input.stripDark) <= shadowFloor;
  const verdict = pickVerdict(highlightsClipped, shadowsCrushed, delta, tolerance);
  return {
    verdict: contrastVerdict(verdict, contrast, contrastTolerance),
    highlightsClipped,
    shadowsCrushed,
    level18,
    level50,
    delta,
    contrast,
  };
}
