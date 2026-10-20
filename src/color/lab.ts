import { linearToSrgb, srgbToLinear } from './srgb';

export type Vec3 = readonly [number, number, number];
type Matrix3 = readonly [Vec3, Vec3, Vec3];

// Reference white points D50 (as in CSS Color 4) and D65, each with Y = 1.
const WHITE_D50: Vec3 = [0.3457 / 0.3585, 1, (1 - 0.3457 - 0.3585) / 0.3585];

const SRGB_TO_XYZ_D65: Matrix3 = [
  [0.412_456_4, 0.357_576_1, 0.180_437_5],
  [0.212_672_9, 0.715_152_2, 0.072_175],
  [0.019_333_9, 0.119_192, 0.950_304_1],
];

const XYZ_D65_TO_SRGB: Matrix3 = [
  [3.240_454_2, -1.537_138_5, -0.498_531_4],
  [-0.969_266, 1.876_010_8, 0.041_556],
  [0.055_643_4, -0.204_025_9, 1.057_225_2],
];

// Bradford adaptation between the white points D65 and D50.
const D65_TO_D50: Matrix3 = [
  [1.047_811_2, 0.022_886_6, -0.050_127],
  [0.029_542_4, 0.990_484_4, -0.017_049_1],
  [-0.009_234_5, 0.015_043_6, 0.752_131_6],
];

const D50_TO_D65: Matrix3 = [
  [0.955_576_6, -0.023_039_3, 0.063_163_6],
  [-0.028_289_5, 1.009_941_6, 0.021_007_7],
  [0.012_298_2, -0.020_483, 1.329_909_8],
];

const EPSILON = 216 / 24_389;
const KAPPA = 24_389 / 27;

function multiply(matrix: Matrix3, [x, y, z]: Vec3): Vec3 {
  const [a, b, c] = matrix;
  return [
    a[0] * x + a[1] * y + a[2] * z,
    b[0] * x + b[1] * y + b[2] * z,
    c[0] * x + c[1] * y + c[2] * z,
  ];
}

// Linear sRGB value (D65) -> XYZ with D50 white point.
export function linearSrgbToXyzD50(rgb: Vec3): Vec3 {
  return multiply(D65_TO_D50, multiply(SRGB_TO_XYZ_D65, rgb));
}

// XYZ with D50 white point -> linear sRGB value (D65), without clamping.
function xyzD50ToLinearSrgb(xyz: Vec3): Vec3 {
  return multiply(XYZ_D65_TO_SRGB, multiply(D50_TO_D65, xyz));
}

function forward(ratio: number): number {
  return ratio > EPSILON ? Math.cbrt(ratio) : (KAPPA * ratio + 16) / 116;
}

function inverse(value: number): number {
  const cubed = value ** 3;
  return cubed > EPSILON ? cubed : (116 * value - 16) / KAPPA;
}

export function xyzD50ToLab([x, y, z]: Vec3): Vec3 {
  const fx = forward(x / WHITE_D50[0]);
  const fy = forward(y / WHITE_D50[1]);
  const fz = forward(z / WHITE_D50[2]);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function labToXyzD50([l, a, b]: Vec3): Vec3 {
  const fy = (l + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const yr = l > KAPPA * EPSILON ? fy ** 3 : l / KAPPA;
  return [inverse(fx) * WHITE_D50[0], yr * WHITE_D50[1], inverse(fz) * WHITE_D50[2]];
}

// sRGB-encoded value (0..1) -> CIE Lab (D50).
export function srgbToLab(code: Vec3): Vec3 {
  const [r, g, b] = code;
  return xyzD50ToLab(linearSrgbToXyzD50([srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)]));
}

// CIE Lab (D50) -> sRGB-encoded value, clamped to 0..1.
function toCode(value: number): number {
  return linearToSrgb(Math.min(Math.max(value, 0), 1));
}

export function labToSrgb(lab: Vec3): Vec3 {
  const [r, g, b] = xyzD50ToLinearSrgb(labToXyzD50(lab));
  return [toCode(r), toCode(g), toCode(b)];
}

// CIE Lab (D50) -> linear sRGB value (D65), unclamped.
export function labToLinearSrgb(lab: Vec3): Vec3 {
  return xyzD50ToLinearSrgb(labToXyzD50(lab));
}

const DEG = Math.PI / 180;

function hueAngle(b: number, aPrime: number): number {
  if (b === 0 && aPrime === 0) {
    return 0;
  }
  const hue = Math.atan2(b, aPrime) / DEG;
  return hue < 0 ? hue + 360 : hue;
}

function hueDifference(c1: number, c2: number, h1: number, h2: number): number {
  if (c1 * c2 === 0) {
    return 0;
  }
  const diff = h2 - h1;
  if (Math.abs(diff) <= 180) {
    return diff;
  }
  return diff > 180 ? diff - 360 : diff + 360;
}

function hueMean(c1: number, c2: number, h1: number, h2: number): number {
  if (c1 * c2 === 0) {
    return h1 + h2;
  }
  if (Math.abs(h1 - h2) <= 180) {
    return (h1 + h2) / 2;
  }
  return (h1 + h2 + (h1 + h2 < 360 ? 360 : -360)) / 2;
}

// Color difference CIEDE2000 (Sharma et al., kL = kC = kH = 1).
export function deltaE2000(first: Vec3, second: Vec3): number {
  const [l1, a1, b1] = first;
  const [l2, a2, b2] = second;
  const cBar = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const g = 0.5 * (1 - Math.sqrt(cBar ** 7 / (cBar ** 7 + 25 ** 7)));
  const a1p = (1 + g) * a1;
  const a2p = (1 + g) * a2;
  const c1 = Math.hypot(a1p, b1);
  const c2 = Math.hypot(a2p, b2);
  const h1 = hueAngle(b1, a1p);
  const h2 = hueAngle(b2, a2p);

  const dL = l2 - l1;
  const dC = c2 - c1;
  const dH = 2 * Math.sqrt(c1 * c2) * Math.sin((hueDifference(c1, c2, h1, h2) * DEG) / 2);

  const lBar = (l1 + l2) / 2;
  const cBarP = (c1 + c2) / 2;
  const hBar = hueMean(c1, c2, h1, h2);
  const t =
    1 -
    0.17 * Math.cos((hBar - 30) * DEG) +
    0.24 * Math.cos(2 * hBar * DEG) +
    0.32 * Math.cos((3 * hBar + 6) * DEG) -
    0.2 * Math.cos((4 * hBar - 63) * DEG);
  const deltaTheta = 30 * Math.exp(-(((hBar - 275) / 25) ** 2));
  const rC = 2 * Math.sqrt(cBarP ** 7 / (cBarP ** 7 + 25 ** 7));
  const sL = 1 + (0.015 * (lBar - 50) ** 2) / Math.sqrt(20 + (lBar - 50) ** 2);
  const sC = 1 + 0.045 * cBarP;
  const sH = 1 + 0.015 * cBarP * t;
  const rT = -Math.sin(2 * deltaTheta * DEG) * rC;

  return Math.sqrt((dL / sL) ** 2 + (dC / sC) ** 2 + (dH / sH) ** 2 + rT * (dC / sC) * (dH / sH));
}
