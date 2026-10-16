import { DEFAULT_EXPOSURE_CONFIG, describeExposure } from '../chart/exposure';
import type { ExposureResult } from '../chart/exposure';

// Abweichung der großen Felder vom Sollwert (in Helligkeitsanteilen), die den vollen Ausschlag ergibt.
const SCALE_RANGE = 0.3;
const HALF = 50;

function clamp(value: number): number {
  return Math.min(Math.max(value, 0), 100);
}

// Lage der Marke auf der senkrechten Skala in Prozent von oben (0 = zu hell, 100 = zu dunkel).
export function scalePosition(delta: number): number {
  return clamp(HALF - (delta / SCALE_RANGE) * HALF);
}

// Grüner Bereich der Skala (Prozent von oben), passend zur erlaubten Abweichung.
export function okBand(tolerance = DEFAULT_EXPOSURE_CONFIG.tolerance): {
  from: number;
  to: number;
} {
  const half = (tolerance / SCALE_RANGE) * HALF;
  return { from: clamp(HALF - half), to: clamp(HALF + half) };
}

const SOFT = 2;

// Farbverlauf der Skala: oben zu hell, Mitte passend, unten zu dunkel.
export function scaleGradient(band = okBand()): string {
  return `linear-gradient(to bottom, #ea580c 0%, #ea580c ${String(band.from - SOFT)}%, #16a34a ${String(band.from)}%, #16a34a ${String(band.to)}%, #1d4ed8 ${String(band.to + SOFT)}%, #1d4ed8 100%)`;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(0)} %`;
}

function signed(value: number): string {
  const points = value * 100;
  return `${points >= 0 ? '+' : '−'}${Math.abs(points).toFixed(0)} Punkte`;
}

export interface DetailRow {
  label: string;
  value: string;
}

export function detailRows(exposure: ExposureResult): DetailRow[] {
  return [
    { label: '18 %-Feld', value: percent(exposure.level18) },
    { label: '50 %-Feld', value: percent(exposure.level50) },
    { label: 'Abweichung', value: signed(exposure.delta) },
    { label: 'Lichter', value: exposure.highlightsClipped ? 'geclippt' : 'ok' },
    { label: 'Schatten', value: exposure.shadowsCrushed ? 'abgesoffen' : 'ok' },
  ];
}

// Zusammenfassung für Screenreader und Tooltip-Überschrift.
export function summary(exposure: ExposureResult | null): string {
  return exposure === null ? 'Noch keine Messung.' : describeExposure(exposure);
}
