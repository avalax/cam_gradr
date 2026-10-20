// Converts an sRGB value (0..1) to a linear value.
export function srgbToLinear(value: number): number {
  return value <= 0.040_45 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

// Converts a linear value (0..1) to sRGB-encoded.
export function linearToSrgb(value: number): number {
  return value <= 0.003_130_8 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
}
