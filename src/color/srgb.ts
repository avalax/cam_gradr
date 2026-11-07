// Channels of an RGB value, as frames and LUTs store them one after the other.
export const CHANNELS = 3;

// Largest 8-bit code value.
export const MAX_CODE = 255;

// Converts an sRGB value (0..1) to a linear value.
export function srgbToLinear(value: number): number {
  return value <= 0.040_45 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

// Converts a linear value (0..1) to sRGB-encoded.
export function linearToSrgb(value: number): number {
  return value <= 0.003_130_8 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
}

// Converts a linear value to sRGB-encoded; what lies outside 0..1 is cut off first.
export function linearToSrgbClamped(value: number): number {
  return linearToSrgb(Math.min(Math.max(value, 0), 1));
}

// A value 0..1 as an 8-bit code; what lies outside is cut off.
export function toByte(value: number): number {
  return Math.round(Math.min(Math.max(value, 0), 1) * MAX_CODE);
}
