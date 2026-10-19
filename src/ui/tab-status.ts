import type { ExposureResult } from '../chart/exposure';

import { oneDecimal } from './gray-wedge';
import { mainIssue } from './measure-field';

export type StatusLevel = 'off' | 'warn' | 'ok';

// Status eines Tabs: Stufe, Füllung der Mini-Skala (0 bis 4 Striche) und ein kurzer Ergebnistext.
export interface TabStatus {
  level: StatusLevel;
  fill: number;
  text: string;
}

// Mittlere Abweichung (ΔE2000) nach der Korrektur: bis hierher gut, bis zur zweiten Grenze ein Hinweis,
// darüber deutlich zu hoch.
const COLOR_GOOD = 2;
const COLOR_FAIR = 5;

const FILL_OK = 4;
const FILL_FAIR = 3;
const FILL_POOR = 2;

// Graukarten: grün nur, wenn der Messpunkt im Normalbereich liegt; sonst der wichtigste Hinweis.
export function grayStatus(exposure: ExposureResult | null): TabStatus {
  if (exposure === null) {
    return { level: 'off', fill: 0, text: 'Noch nicht gemessen' };
  }
  if (exposure.verdict === 'ok') {
    return { level: 'ok', fill: FILL_OK, text: 'Licht passt' };
  }
  return {
    level: 'warn',
    fill: FILL_POOR,
    text: mainIssue(exposure)?.label ?? 'Licht prüfen',
  };
}

// Farbkarten: der Status folgt der mittleren Abweichung nach der Korrektur, nicht dem bloßen Berechnen.
export function colorStatus(report: { meanBefore: number; meanAfter: number } | null): TabStatus {
  if (report === null) {
    return { level: 'off', fill: 0, text: 'Noch nicht berechnet' };
  }
  const text = `Ø ${oneDecimal(report.meanBefore)} → ${oneDecimal(report.meanAfter)}`;
  if (report.meanAfter <= COLOR_GOOD) {
    return { level: 'ok', fill: FILL_OK, text };
  }
  return { level: 'warn', fill: report.meanAfter <= COLOR_FAIR ? FILL_FAIR : FILL_POOR, text };
}
