import type { Vec3 } from '../color/lab';
import { applyColorModel } from '../solve/fit';
import type { ColorModel } from '../solve/fit';

// 3D LUT over sRGB-encoded values (0..1). The data is in the usual cube format:
// size³ entries of three values each (R, G, B), with R varying fastest and B slowest.
export interface Lut {
  size: number;
  data: Float32Array;
}

const MIN_SIZE = 2;
const MAX_SIZE = 129;
const CHANNELS = 3;

function checkSize(size: number): void {
  if (!Number.isSafeInteger(size) || size < MIN_SIZE || size > MAX_SIZE) {
    throw new RangeError(
      `The LUT size must be an integer from ${String(MIN_SIZE)} to ${String(MAX_SIZE)}.`,
    );
  }
}

function fill(size: number, nodeValue: (r: number, g: number, b: number) => Vec3): Lut {
  checkSize(size);
  const data = new Float32Array(size ** 3 * CHANNELS);
  const last = size - 1;
  let offset = 0;
  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        const [rr, gg, bb] = nodeValue(r / last, g / last, b / last);
        data[offset] = rr;
        data[offset + 1] = gg;
        data[offset + 2] = bb;
        offset += CHANNELS;
      }
    }
  }
  return { size, data };
}

export function identityLut(size: number): Lut {
  return fill(size, (r, g, b) => [r, g, b]);
}

// Evaluates the correction model at all grid points.
export function buildLut(model: ColorModel, size: number): Lut {
  return fill(size, (r, g, b) => applyColorModel(model, [r, g, b]));
}

// Trilinear interpolation, as the graphics card performs it when sampling the 3D texture.
export function sampleLut(lut: Lut, [r, g, b]: Vec3): Vec3 {
  const last = lut.size - 1;
  const position = [r, g, b].map((value) => Math.min(Math.max(value, 0), 1) * last);
  const base = position.map((value) => Math.min(Math.floor(value), last - 1));
  const [x, y, z] = position.map((value, axis) => value - Number(base[axis]));
  const [i, j, k] = base;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  for (let corner = 0; corner < 8; corner++) {
    const dx = corner & 1;
    const dy = (corner >> 1) & 1;
    const dz = (corner >> 2) & 1;
    const weight =
      (dx === 1 ? Number(x) : 1 - Number(x)) *
      (dy === 1 ? Number(y) : 1 - Number(y)) *
      (dz === 1 ? Number(z) : 1 - Number(z));
    const offset =
      ((Number(k) + dz) * lut.size * lut.size + (Number(j) + dy) * lut.size + Number(i) + dx) *
      CHANNELS;
    sumR += weight * Number(lut.data[offset]);
    sumG += weight * Number(lut.data[offset + 1]);
    sumB += weight * Number(lut.data[offset + 2]);
  }
  return [sumR, sumG, sumB];
}
