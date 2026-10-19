import { applyColorModel } from '../solve/fit';
import type { ColorModel } from '../solve/fit';

import { cssColor } from './color-css';

// Blauanteile der vier Schnitte durch den Farbwürfel (je ein Rot-Grün-Feld bei festem Blau).
const BLUE_LEVELS = [0.15, 0.4, 0.65, 0.9] as const;

// Die LUT als vier kleine Farbfelder: Jedes Feld zeigt, in welche Farben die Korrektur die Rot-Grün-Ebene
// bei einem festen Blauanteil verschiebt (oben Grün, rechts Rot).
export function lutSlices(model: ColorModel, cells: number): string[][] {
  const last = cells - 1;
  return BLUE_LEVELS.map((blue) => {
    const colors: string[] = [];
    for (let row = 0; row < cells; row++) {
      for (let column = 0; column < cells; column++) {
        const code = applyColorModel(model, [column / last, 1 - row / last, blue]);
        colors.push(cssColor(code));
      }
    }
    return colors;
  });
}

// Geschätzte Größe der .cube-Datei: Jede Zeile hat 27 Zeichen (drei Werte mit sechs Nachkommastellen).
const BYTES_PER_LINE = 27;
const HEADER_BYTES = 110;
const KILO = 1000;

export function cubeSizeText(size: number): string {
  const bytes = size ** 3 * BYTES_PER_LINE + HEADER_BYTES;
  const mega = bytes / (KILO * KILO);
  if (mega < 1) {
    return `ca. ${String(Math.round(bytes / KILO))} KB`;
  }
  return `ca. ${mega.toFixed(1).replace('.', ',')} MB`;
}
