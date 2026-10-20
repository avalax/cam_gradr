import type { Vec3 } from '../color/lab';

const MAX_CODE = 255;

// CSS color to an sRGB-encoded value (0..1).
export function cssColor(code: Vec3): string {
  const [r, g, b] = code.map((value) => Math.round(value * MAX_CODE));
  return `rgb(${String(r)}, ${String(g)}, ${String(b)})`;
}
