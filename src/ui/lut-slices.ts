import { t } from '../lang';
import { formatDecimal } from '../lang/format';
import { applyColorModel } from '../solve/fit';
import type { ColorModel } from '../solve/fit';

import { cssColor } from './color-css';

// Blue fractions of the four slices through the color cube (one red-green field each at fixed
// blue).
const BLUE_LEVELS = [0.15, 0.4, 0.65, 0.9] as const;

// The LUT as four small color fields: each field shows which colors the correction maps the
// red-green plane to at a fixed blue fraction (green at the top, red on the right).
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
