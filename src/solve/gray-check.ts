import type { Measurements } from '../chart/measure';
import type { ChartLayout, PatchLayout } from '../chart/types';
import { deltaE2000, srgbToLab } from '../color/lab';

import { applyColorModel } from './fit';
import type { ColorModel } from './fit';

export interface GrayCheck {
  id: string;
  before: number;
  after: number;
}

function check(model: ColorModel, patch: PatchLayout, measured: Measurements[string]) {
  const nominal = patch.nominalLab ?? [0, 0, 0];
  const corrected = srgbToLab(applyColorModel(model, measured));
  return {
    id: patch.id,
    before: deltaE2000(srgbToLab(measured), nominal),
    after: deltaE2000(corrected, nominal),
  };
}

// Kontrolle mit den Graukarten: Die großen Felder (mit Nennwert) gehen nicht in die Berechnung ein.
// Wie weit sie vor und nach der Korrektur vom Nennwert abweichen, zeigt unabhängig, ob die Tonkurve
// auch dort stimmt, wo sie nicht angepasst wurde (oder ob sich das Licht zwischen den Aufnahmen
// geändert hat).
export function checkGrayCards(
  model: ColorModel,
  measurements: Measurements,
  layout: ChartLayout,
): GrayCheck[] {
  const patches = layout.cards.flatMap((card) => card.patches);
  return patches
    .filter((patch) => patch.nominalLab !== undefined && measurements[patch.id] !== undefined)
    .map((patch) => check(model, patch, measurements[patch.id] ?? [0, 0, 0]));
}
