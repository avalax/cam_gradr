import { DEFAULT_EXPOSURE_CONFIG, describeContrast } from '../chart/exposure';
import type { ExposureResult } from '../chart/exposure';

import type { DetailRow } from './brightness-scale';

// Abweichung des Abstands (in Helligkeitsanteilen), die den vollen Ausschlag ergibt.
const SCALE_RANGE = 0.2;
const HALF = 50;

function clamp(value: number): number {
  return Math.min(Math.max(value, 0), 100);
}

// Lage der Marke auf der senkrechten Skala in Prozent von oben (0 = zu viel Kontrast, 100 = zu flach).
export function contrastPosition(delta: number): number {
  return clamp(HALF - (delta / SCALE_RANGE) * HALF);
}

// Zielbereich der Skala (Prozent von oben), passend zur erlaubten Abweichung.
export function contrastBand(tolerance = DEFAULT_EXPOSURE_CONFIG.contrastTolerance): {
  from: number;
  to: number;
} {
  const half = (tolerance / SCALE_RANGE) * HALF;
  return { from: clamp(HALF - half), to: clamp(HALF + half) };
}

// Oben scharfe Trennung zwischen dunkel und hell (viel Kontrast), unten einheitliches Grau (flach).
export function contrastGradient(): string {
  return 'linear-gradient(to bottom, rgba(115, 115, 115, 0) 0%, rgb(115, 115, 115) 100%), linear-gradient(to right, #171717 50%, #f5f5f5 50%)';
}

function percent(value: number): string {
  return `${(value * 100).toFixed(0)} %`;
}

function signed(value: number): string {
  const points = value * 100;
  return `${points >= 0 ? '+' : '−'}${Math.abs(points).toFixed(0)} Punkte`;
}

export function contrastRows(exposure: ExposureResult): DetailRow[] {
  const spread = exposure.level50 - exposure.level18;
  return [
    { label: '18 %-Feld', value: percent(exposure.level18) },
    { label: '50 %-Feld', value: percent(exposure.level50) },
    { label: 'Abstand', value: percent(spread) },
    { label: 'Abweichung', value: signed(exposure.contrast) },
  ];
}

export function contrastSummary(exposure: ExposureResult | null): string {
  return exposure === null ? 'Noch keine Messung.' : describeContrast(exposure);
}
