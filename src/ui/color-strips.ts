import type { Measurements } from '../chart/measure';
import { labToSrgb } from '../color/lab';
import type { Vec3 } from '../color/lab';
import type { ReferenceSet } from '../reference/reference';
import { applyColorModel } from '../solve/fit';
import type { ColorModel } from '../solve/fit';

import { cssColor } from './color-css';

// Farbe eines Feldes, solange nichts gemessen oder berechnet ist und es auch keinen Referenzwert gibt.
export const NEUTRAL_SWATCH = 'rgb(203, 213, 225)';

interface Swatch {
  id: string;
  css: string;
  // Aus einer Messung (oder Korrektur) oder nur ein Standardwert?
  measured: boolean;
}

export interface Strips {
  camera: Swatch[];
  corrected: Swatch[];
}

// Standardfarbe eines Feldes: der Sollwert der Referenz, sonst ein neutrales Grau.
function fallback(reference: ReferenceSet | null, id: string): string {
  const lab = reference?.patches[id];
  return lab === undefined ? NEUTRAL_SWATCH : cssColor(labToSrgb(lab));
}

// Farben der beiden Ebenen in der Reihenfolge der Feld-IDs: links, was die Kamera von der Karte
// sieht, rechts nach der Korrektur. Wo es keine Messung gibt, steht der Sollwert. Ohne Korrektur
// (kein Modell) bleibt die rechte Seite gleich der linken, damit der Wischer allein nichts verändert.
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
