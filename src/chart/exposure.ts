import { linearToSrgb, srgbToLinear } from '../color/srgb';

import type { Rgb } from './types';

export interface ExposureConfig {
  // Ab diesem Kanalwert (0..1) gilt das hellste Streifenfeld als geclippt.
  highlightClip: number;
  // Bis zu diesem Helligkeitswert (0..1) gilt das dunkelste Streifenfeld als abgesoffen.
  shadowFloor: number;
  // Sollhelligkeit (sRGB-codiert, 0..1) der großen Felder: 18 % Reflexion ≈ 0,46, 50 % ≈ 0,74.
  target18: number;
  target50: number;
  // Erlaubte mittlere Abweichung der großen Felder vom Sollwert.
  tolerance: number;
  // Erlaubte Abweichung des Abstands zwischen den beiden großen Feldern vom Sollabstand.
  contrastTolerance: number;
}

export const DEFAULT_EXPOSURE_CONFIG: ExposureConfig = {
  highlightClip: 0.95,
  shadowFloor: 0.03,
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

type Verdict = 'too-dark' | 'ok' | 'too-bright' | 'high-contrast';

export interface ExposureResult {
  verdict: Verdict;
  highlightsClipped: boolean;
  shadowsCrushed: boolean;
  level18: number;
  level50: number;
  // Mittlere Abweichung der großen Felder vom Sollwert (positiv = zu hell).
  delta: number;
  // Abweichung des Abstands zwischen dem 50 %- und dem 18 %-Feld vom Sollabstand (positiv = zu viel
  // Kontrast, negativ = zu flach).
  contrast: number;
}

// Helligkeit eines sRGB-codierten Farbwerts (Rec.709-Luminanz, wieder sRGB-codiert).
export function codeLuma(rgb: Rgb): number {
  const [r, g, b] = rgb;
  return linearToSrgb(
    0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b),
  );
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

export function assessExposure(
  input: ExposureInput,
  config: ExposureConfig = DEFAULT_EXPOSURE_CONFIG,
): ExposureResult {
  const level18 = codeLuma(input.large18);
  const level50 = codeLuma(input.large50);
  const delta = (level18 - config.target18 + (level50 - config.target50)) / 2;
  const contrast = level50 - level18 - (config.target50 - config.target18);
  const highlightsClipped = Math.max(...input.stripLight) >= config.highlightClip;
  const shadowsCrushed = codeLuma(input.stripDark) <= config.shadowFloor;
  return {
    verdict: pickVerdict(highlightsClipped, shadowsCrushed, delta, config.tolerance),
    highlightsClipped,
    shadowsCrushed,
    level18,
    level50,
    delta,
    contrast,
  };
}
