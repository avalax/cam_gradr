import { t } from '../lang';
import { formatDecimal } from '../lang/format';
import { blendColor, sampleLook } from '../look/look';
import type { LookLut } from '../look/look';
import { applyColorModel } from '../solve/fit';
import type { ColorModel } from '../solve/fit';

import { cssColor } from './color-css';

// Blue fractions of the eight slices through the color cube (one red-green field each at fixed
// blue), evenly spread. Where the export has room for one row only, it shows every second one.
const SLICES = 8;
const BLUE_LEVELS = Array.from({ length: SLICES }, (_, index) => (index + 0.5) / SLICES);

// The look LUT over the correction, with its strength (0..1).
export interface SliceLook {
  lut: LookLut;
  amount: number;
}

// The LUT as eight small color fields: each field shows which colors the correction (and the look
// over it) maps the red-green plane to at a fixed blue fraction (green at the top, red on the
// right).
export function lutSlices(
  model: ColorModel,
  cells: number,
  look: SliceLook | null = null,
): string[][] {
  const last = cells - 1;
  return BLUE_LEVELS.map((blue) => {
    const colors: string[] = [];
    for (let row = 0; row < cells; row++) {
      for (let column = 0; column < cells; column++) {
        const code = applyColorModel(model, [column / last, 1 - row / last, blue]);
        const shown =
          look === null ? code : blendColor(code, sampleLook(look.lut, code), look.amount);
        colors.push(cssColor(shown));
      }
    }
    return colors;
  });
}

// Estimated size of the .cube file: each line has 27 characters (three values with six decimals).
const BYTES_PER_LINE = 27;
const HEADER_BYTES = 110;
const KILO = 1000;

export function cubeSizeText(size: number): string {
  const bytes = size ** 3 * BYTES_PER_LINE + HEADER_BYTES;
  const mega = bytes / (KILO * KILO);
  if (mega < 1) {
    return t('export.lut.sizeKb', { value: String(Math.round(bytes / KILO)) });
  }
  return t('export.lut.sizeMb', { value: formatDecimal(mega, 1) });
}
