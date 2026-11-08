import { HUE_COEFFICIENTS } from '../solve/fit';
import type { ColorModel } from '../solve/fit';

// A hue table that turns and scales nothing.
export const FLAT_HUE: readonly number[] = Array.from({ length: HUE_COEFFICIENTS }, () => 0);

const STRAIGHT = { xs: [0, 1], ys: [0, 1] };

// The correction that changes nothing: straight tone curves, the identity matrix, a flat hue table.
export const IDENTITY_MODEL: ColorModel = {
  curves: [STRAIGHT, STRAIGHT, STRAIGHT],
  matrix: [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
  hue: FLAT_HUE,
};
