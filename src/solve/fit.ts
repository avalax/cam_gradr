import { t } from '../lang';
import { deltaE2000, labToLinearSrgb, labToXyzD50, srgbToLab, xyzD50ToLab } from '../color/lab';
import type { Vec3 } from '../color/lab';
import { linearToSrgb, srgbToLinear } from '../color/srgb';
import type { Rgb } from '../chart/types';
import type { ReferenceSet } from '../reference/reference';

import { createPchip } from './pchip';
import type { Curve } from './pchip';

// Correction model: one tone curve per channel (including white balance) on linear values, then
// a 3×3 matrix whose rows sum to 1 (neutral stays neutral).
export interface ColorModel {
  curves: readonly [Curve, Curve, Curve];
  matrix: readonly [Vec3, Vec3, Vec3];
}

interface PatchError {
  id: string;
  // Target color (Lab, D50) and measured camera value (sRGB-encoded) of the patch.
  reference: Vec3;
  measured: Rgb;
  before: number;
  after: number;
  neutral: boolean;
}

// Mean error of a patch group (neutral or color patches).
interface GroupStats {
  count: number;
  meanBefore: number;
  meanAfter: number;
}

interface FitReport {
  patches: PatchError[];
  meanBefore: number;
  meanAfter: number;
  maxBefore: number;
  maxAfter: number;
  // Separated into neutral patches (gray ladder) and colored patches; null if there are none.
  neutral: GroupStats | null;
  color: GroupStats | null;
  // Neutral patches the camera can no longer tell apart (compressed or clipped highlights).
  indistinct: string[];
}

export interface FitResult {
  model: ColorModel;
  report: FitReport;
}

export interface FitInput {
  // Measured camera values (sRGB-encoded, 0..1) per patch ID.
  measurements: Readonly<Record<string, Rgb>>;
  reference: ReferenceSet;
  neutralIds: ReadonlySet<string>;
  // With false only white balance and colors are corrected, not the tone curve (contrast and
  // gamma); the default is true.
  tone?: boolean;
}

const MIN_NEUTRAL = 4;
const MIN_PATCHES = 8;
// Strength of the regularization of the matrix toward the identity (relative to the patch
// count).
const RIDGE = 1e-3;
// Below this slope of the camera response curve (camera value per target value, ideally about 1)
// the camera can hardly distinguish neighboring neutral patches: they then count as one block.
const MIN_RESPONSE_SLOPE = 0.1;
// The correction keeps the exposure of the shot: the reference is scaled by one gain so that the
// mid tones of the gray ramp need no brightening. This gain is the mean over the neutral patches
// whose target lies between these limits (linear, 1 = white).
const EXPOSURE_FROM = 0.05;
const EXPOSURE_TO = 0.6;
// The tone curve is a smooth polynomial through the gray ramp (in log-log space) instead of an
// interpolation through every noisy patch: no steps, no banding, no strong amplification of noise.
const MAX_DEGREE = 3;
// Largest brightening or darkening of a tone curve (factor), also beyond the measured range.
const MAX_GAIN = 1.5;
// Without the tone correction the curve is a straight line up to this knee (at most this value after
// the factor), then it bends to white.
const PLAIN_KNEE = 0.5;
const PLAIN_KNEE_TOP = 0.9;
// Targets above the shoulder are compressed softly towards white: the exposure gain would otherwise
// push the bright gray patches beyond 1, and everything above them would clip.
const SHOULDER = 0.8;
const CURVE_POINTS = 48;
const CURVE_FLOOR = 1e-3;
const IDENTITY: readonly [Vec3, Vec3, Vec3] = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

interface Sample {
  id: string;
  measured: Rgb;
  reference: Vec3;
  linear: Vec3;
  target: Vec3;
  isNeutral: boolean;
}

function samples(input: FitInput): Sample[] {
  const result: Sample[] = [];
  for (const [id, lab] of Object.entries(input.reference.patches)) {
    const measured = input.measurements[id];
    if (measured !== undefined) {
      const isNeutral = input.neutralIds.has(id);
      const gray = labToXyzD50(lab)[1];
      result.push({
        id,
        measured,
        reference: lab,
        linear: [srgbToLinear(measured[0]), srgbToLinear(measured[1]), srgbToLinear(measured[2])],
        // Neutral patches target a pure gray of the same lightness.
        target: isNeutral ? [gray, gray, gray] : labToLinearSrgb(lab),
        isNeutral,
      });
    }
  }
  return result;
}

interface Block {
  ids: string[];
  count: number;
  linear: [number, number, number];
  target: number;
}

function blockLevel(block: Block): number {
  return (block.linear[0] + block.linear[1] + block.linear[2]) / (3 * block.count);
}

// Merges the topmost block with the one below as long as the camera cannot tell them apart.
function mergeFlatTop(blocks: Block[]): void {
  const top = blocks.at(-1);
  const below = blocks.at(-2);
  if (top === undefined || below === undefined) {
    return;
  }
  const rise = blockLevel(top) - blockLevel(below);
  const wanted = top.target / top.count - below.target / below.count;
  if (rise < MIN_RESPONSE_SLOPE * wanted) {
    below.ids.push(...top.ids);
    below.count += top.count;
    below.target += top.target;
    below.linear = [
      below.linear[0] + top.linear[0],
      below.linear[1] + top.linear[1],
      below.linear[2] + top.linear[2],
    ];
    blocks.pop();
    mergeFlatTop(blocks);
  }
}

// Groups neutral patches the camera can no longer tell apart (highlights are clipped or
// compressed, or the measured values even drop again). Otherwise the three channels order these
// patches differently, and the curves produce a color cast. All channels share the same blocks.
function poolNeutrals(neutrals: readonly Sample[]): Block[] {
  const sorted = neutrals.toSorted((a, b) => a.target[0] - b.target[0]);
  const blocks: Block[] = [];
  for (const sample of sorted) {
    blocks.push({
      ids: [sample.id],
      count: 1,
      linear: [...sample.linear],
      target: sample.target[0],
    });
    mergeFlatTop(blocks);
  }
  return blocks;
}

// Geometric mean, over the mid tones of the gray ramp, of the factor by which the camera level
// (taken from `level`) lies above the target.
function midGain(blocks: readonly Block[], level: (block: Block) => number): number {
  const logs = blocks
    .map((block) => ({ level: level(block), target: block.target / block.count }))
    .filter(
      (entry) => entry.level > 0 && entry.target >= EXPOSURE_FROM && entry.target <= EXPOSURE_TO,
    )
    .map((entry) => Math.log(entry.level / entry.target));
  return logs.length === 0 ? 1 : Math.exp(mean(logs));
}

// Gain by which the camera is brighter (>1) or darker (<1) than the reference in the mid tones.
// Scaling the reference by it keeps the exposure of the shot (only color cast and tone curve are
// corrected, not the brightness).
function exposureGain(blocks: readonly Block[]): number {
  return midGain(blocks, blockLevel);
}

// Reference color (Lab) with the exposure gain applied to its linear light.
function scaledLab(lab: Vec3, gain: number): Vec3 {
  const [x, y, z] = labToXyzD50(lab);
  return xyzD50ToLab([x * gain, y * gain, z * gain]);
}

// Solves a small symmetric positive definite system given as its augmented matrix (n rows of
// n + 1 numbers, flat) by Gaussian elimination; the normal equations of a least-squares fit need
// no pivoting.
function solve(augmented: number[], n: number): number[] {
  const width = n + 1;
  for (let column = 0; column < n; column++) {
    for (let row = column + 1; row < n; row++) {
      const factor =
        Number(augmented[row * width + column]) / Number(augmented[column * width + column]);
      for (let k = column; k <= n; k++) {
        augmented[row * width + k] =
          Number(augmented[row * width + k]) - factor * Number(augmented[column * width + k]);
      }
    }
  }
  const result: number[] = Array.from({ length: n }, () => 0);
  for (let row = n - 1; row >= 0; row--) {
    let rest = Number(augmented[row * width + n]);
    for (let k = row + 1; k < n; k++) {
      rest -= Number(augmented[row * width + k]) * Number(result[k]);
    }
    result[row] = rest / Number(augmented[row * width + row]);
  }
  return result;
}

// Least-squares polynomial of the given degree through the points (u, v); u is centered for
// numerical stability. Returns a function of u.
function polynomial(points: readonly (readonly [number, number])[], degree: number) {
  const center = mean(points.map(([u]) => u));
  const size = degree + 1;
  const augmented: number[] = Array.from({ length: size * (size + 1) }, () => 0);
  for (const [u, v] of points) {
    const x = u - center;
    for (let row = 0; row < size; row++) {
      for (let column = 0; column < size; column++) {
        augmented[row * (size + 1) + column] =
          Number(augmented[row * (size + 1) + column]) + x ** (row + column);
      }
      augmented[row * (size + 1) + size] =
        Number(augmented[row * (size + 1) + size]) + v * x ** row;
    }
  }
  const coefficients = solve(augmented, size);
  return (u: number): number => {
    let value = 0;
    for (const [power, coefficient] of coefficients.entries()) {
      value += coefficient * (u - center) ** power;
    }
    return value;
  };
}

// Tone curve of a channel from the (camera value, target value) pairs of the gray ramp, both
// linear: the logarithm of the gain (target / camera) is a polynomial of the logarithm of the
// camera value. Beyond the measured range the gain stays constant at the edge value, and it is
// limited so that noise is not amplified without bounds.
function shoulder(value: number): number {
  return value <= SHOULDER
    ? value
    : SHOULDER + (1 - SHOULDER) * (1 - Math.exp(-(value - SHOULDER) / (1 - SHOULDER)));
}

function buildCurve(points: readonly (readonly [number, number])[]): Curve {
  const usable = points.filter(([x, y]) => x > CURVE_FLOOR / 10 && y > 0);
  const logs = usable.map(([x, y]): [number, number] => [Math.log(x), Math.log(y / x)]);
  const limit = Math.log(MAX_GAIN);
  const degree = Math.min(MAX_DEGREE, logs.length - 1);
  const first = Math.min(...logs.map(([u]) => u));
  const last = Math.max(...logs.map(([u]) => u));
  const gain = degree < 0 ? () => 0 : polynomial(logs, degree);
  const clamp = (value: number, from: number, to: number): number =>
    Math.min(Math.max(value, from), to);
  const at = (u: number): number => clamp(gain(clamp(u, first, last)), -limit, limit);
  const low = Math.log(CURVE_FLOOR);
  const xs: number[] = [0];
  const ys: number[] = [0];
  let previous = 0;
  for (let step = 0; step < CURVE_POINTS; step++) {
    const u = low + ((0 - low) * step) / (CURVE_POINTS - 1);
    const x = Math.exp(u);
    // The curve never falls.
    previous = Math.max(x * Math.exp(at(u)), previous);
    xs.push(x);
    ys.push(previous);
  }
  return { xs, ys };
}

// Row-wise least-squares estimate of the matrix with the constraint row sum = 1 and
// weak regularization toward the identity matrix.
interface Pair {
  corrected: Vec3;
  target: Vec3;
}

// Row-wise least-squares estimate of the matrix with the constraint row sum = 1 and
// weak regularization toward the identity matrix.
function fitMatrix(pairs: readonly Pair[]): readonly [Vec3, Vec3, Vec3] {
  const lambda = RIDGE * pairs.length;
  const rows = IDENTITY.map((prior, row): Vec3 => {
    let a11 = lambda;
    let a12 = 0;
    let a22 = lambda;
    let b1 = lambda * prior[0];
    let b2 = lambda * prior[1];
    for (const { corrected: u, target } of pairs) {
      const d1 = u[0] - u[2];
      const d2 = u[1] - u[2];
      const r = Number(target[row]) - u[2];
      a11 += d1 * d1;
      a12 += d1 * d2;
      a22 += d2 * d2;
      b1 += d1 * r;
      b2 += d2 * r;
    }
    // The regularization keeps the determinant well above 0 at all times.
    const det = a11 * a22 - a12 * a12;
    const m1 = (a22 * b1 - a12 * b2) / det;
    const m2 = (a11 * b2 - a12 * b1) / det;
    return [m1, m2, 1 - m1 - m2];
  });
  return rows as unknown as readonly [Vec3, Vec3, Vec3];
}

// Without a tone curve each channel gets one factor (white balance) that brings its mid tones to
// the exposure of the shot, so contrast and gamma stay as they are. Only above the knee the curve
// bends so that it ends at white: a clipped white pixel must stay white, otherwise a factor below 1
// turns every blown-out highlight into a colored one.
function buildPlainCurve(blocks: readonly Block[], channel: number, gain: number): Curve {
  const level = (block: Block): number => Number(block.linear[channel]) / block.count;
  const factor = Math.min(Math.max(gain / midGain(blocks, level), 1 / MAX_GAIN), MAX_GAIN);
  const knee = Math.min(PLAIN_KNEE, PLAIN_KNEE_TOP / factor);
  return { xs: [0, knee, 1], ys: [0, factor * knee, 1] };
}

const evaluators = new WeakMap<ColorModel, readonly ((x: number) => number)[]>();

function curveFunctions(model: ColorModel): readonly ((x: number) => number)[] {
  let functions = evaluators.get(model);
  if (functions === undefined) {
    functions = model.curves.map((curve) => createPchip(curve));
    evaluators.set(model, functions);
  }
  return functions;
}

function toCode(value: number): number {
  return linearToSrgb(Math.min(Math.max(value, 0), 1));
}

// Applies the model to an sRGB-encoded camera value and returns the corrected value.
export function applyColorModel(model: ColorModel, code: Vec3): Vec3 {
  const [fr, fg, fb] = curveFunctions(model) as readonly [
    (x: number) => number,
    (x: number) => number,
    (x: number) => number,
  ];
  const u: Vec3 = [fr(srgbToLinear(code[0])), fg(srgbToLinear(code[1])), fb(srgbToLinear(code[2]))];
  const [a, b, c] = model.matrix;
  return [
    toCode(a[0] * u[0] + a[1] * u[1] + a[2] * u[2]),
    toCode(b[0] * u[0] + b[1] * u[1] + b[2] * u[2]),
    toCode(c[0] * u[0] + c[1] * u[1] + c[2] * u[2]),
  ];
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function groupStats(errors: readonly PatchError[]): GroupStats | null {
  return errors.length === 0
    ? null
    : {
        count: errors.length,
        meanBefore: mean(errors.map((error) => error.before)),
        meanAfter: mean(errors.map((error) => error.after)),
      };
}

function summarize(errors: readonly PatchError[], indistinct: string[]): FitReport {
  const before = errors.map((error) => error.before);
  const after = errors.map((error) => error.after);
  return {
    patches: [...errors],
    meanBefore: mean(before),
    meanAfter: mean(after),
    maxBefore: Math.max(...before),
    maxAfter: Math.max(...after),
    neutral: groupStats(errors.filter((error) => error.neutral)),
    color: groupStats(errors.filter((error) => !error.neutral)),
    indistinct,
  };
}

export function fitColorModel(input: FitInput): FitResult {
  const all = samples(input);
  const neutrals = all.filter((sample) => sample.isNeutral);
  if (all.length < MIN_PATCHES || neutrals.length < MIN_NEUTRAL) {
    throw new RangeError(
      t('solve.tooFewMeasurements', { patches: MIN_PATCHES, neutral: MIN_NEUTRAL }),
    );
  }
  const blocks = poolNeutrals(neutrals);
  const gain = exposureGain(blocks);
  const curves = [0, 1, 2].map((channel) =>
    input.tone === false
      ? buildPlainCurve(blocks, channel, gain)
      : buildCurve(
          blocks.map((block) => [
            Number(block.linear[channel]) / block.count,
            shoulder((gain * block.target) / block.count),
          ]),
        ),
  ) as unknown as ColorModel['curves'];

  const draft: ColorModel = { curves, matrix: IDENTITY };
  const functions = curveFunctions(draft) as readonly [
    (x: number) => number,
    (x: number) => number,
    (x: number) => number,
  ];
  const pairs = all.map((sample): Pair => ({
    corrected: [
      functions[0](sample.linear[0]),
      functions[1](sample.linear[1]),
      functions[2](sample.linear[2]),
    ],
    target: [sample.target[0] * gain, sample.target[1] * gain, sample.target[2] * gain],
  }));
  const model: ColorModel = { curves, matrix: fitMatrix(pairs) };

  const errors = all.map((sample): PatchError => {
    // The deviation is measured against the reference at the exposure of the shot.
    const reference = scaledLab(sample.reference, gain);
    return {
      id: sample.id,
      reference,
      measured: sample.measured,
      neutral: sample.isNeutral,
      before: deltaE2000(srgbToLab(sample.measured), reference),
      after: deltaE2000(srgbToLab(applyColorModel(model, sample.measured)), reference),
    };
  });
  const indistinct = blocks.filter((block) => block.count > 1).flatMap((block) => block.ids);
  return { model, report: summarize(errors, indistinct) };
}
