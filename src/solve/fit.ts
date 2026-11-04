import { t } from '../lang';
import {
  deltaE2000,
  labToLinearSrgb,
  linearSrgbToXyzD50,
  srgbToLab,
  xyzD50ToLab,
} from '../color/lab';
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
  // Target color (Lab, D50, see targetLab) and measured camera value (sRGB-encoded) of the patch.
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
  // Factor by which the shot is brighter (>1) or darker (<1) than the reference in the mid tones.
  // The deviations are measured against the reference at this exposure.
  exposureGain: number;
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
const MAX_DEGREE = 2;
// Largest brightening or darkening of a tone curve (factor), also beyond the measured range.
const MAX_GAIN = 1.5;
// Camera values whose darkest channel lies above this (sRGB code) are close to clipping in every
// channel: the corrected color is blended towards white there and reaches it at (1, 1, 1). A clipped
// white pixel must stay white instead of taking on the white balance as a color. The channel curves
// alone cannot ensure this, as the channels of a camera clip at different brightnesses.
const CLIP_KNEE = 0.96;
// Weak pull of the matrix fine-tuning toward the identity matrix (per squared deviation of its six
// free numbers, in ΔE2000): when the patches hardly differ, tiny gains would otherwise let the matrix
// drift into strong channel mixing.
const REFINE_RIDGE = 0.2;
// Targets above the shoulder are compressed softly towards white: the exposure gain would otherwise
// push the bright gray patches beyond 1, and everything above them would clip.
const SHOULDER = 0.8;
// Mixed colors are never cut off at the edge of the sRGB cube: where the most saturated camera color
// of a direction would land beyond it, the part of that direction beyond this share of the way from
// gray to the edge is shortened in proportion (see withinGamut).
const GAMUT_KNEE = 0.8;
// Each camera primary keeps at least this share of its luminance in sRGB, and the weight of the
// penalty below it: a matrix that turns a pure camera blue darker than black leaves no room to show
// different blues apart.
const MIN_PRIMARY_LUMINANCE = 0.5;
const PRIMARY_PENALTY = 1000;
const LUMINANCE: Vec3 = [0.2126, 0.7152, 0.0722];
// Highest saturation (Lab chroma) relative to the reference that the matrix fine-tuning allows
// without penalty, and the weight of the penalty above it.
const SATURATION_LIMIT = 1.1;
const SATURATION_PENALTY = 1;
const CURVE_POINTS = 48;
// Step sizes of the matrix fine-tuning and the maximum number of sweeps per step size.
const REFINE_STEPS = [0.1, 0.05, 0.02, 0.01, 0.004, 0.0015];
const REFINE_SWEEPS = 40;
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
      result.push({
        id,
        measured,
        reference: lab,
        linear: [srgbToLinear(measured[0]), srgbToLinear(measured[1]), srgbToLinear(measured[2])],
        // The neutral patches, too, target their reference color and not a pure gray: the gray ramp
        // of a card is slightly tinted, and a camera that shows it correctly must stay unchanged.
        target: labToLinearSrgb(lab),
        isNeutral: input.neutralIds.has(id),
      });
    }
  }
  return result;
}

interface Block {
  ids: string[];
  count: number;
  // Sums over the patches of the block: camera values and targets, both linear, per channel.
  linear: [number, number, number];
  target: [number, number, number];
}

function blockLevel(block: Block): number {
  return (block.linear[0] + block.linear[1] + block.linear[2]) / (3 * block.count);
}

function targetLevel(block: Block): number {
  return (block.target[0] + block.target[1] + block.target[2]) / (3 * block.count);
}

function sumOf(first: Vec3, second: Vec3): [number, number, number] {
  return [first[0] + second[0], first[1] + second[1], first[2] + second[2]];
}

// Merges the topmost block with the one below as long as the camera cannot tell them apart.
function mergeFlatTop(blocks: Block[]): void {
  const top = blocks.at(-1);
  const below = blocks.at(-2);
  if (top === undefined || below === undefined) {
    return;
  }
  const rise = blockLevel(top) - blockLevel(below);
  const wanted = targetLevel(top) - targetLevel(below);
  if (rise < MIN_RESPONSE_SLOPE * wanted) {
    below.ids.push(...top.ids);
    below.count += top.count;
    below.target = sumOf(below.target, top.target);
    below.linear = sumOf(below.linear, top.linear);
    blocks.pop();
    mergeFlatTop(blocks);
  }
}

// Groups neutral patches the camera can no longer tell apart (highlights are clipped or
// compressed, or the measured values even drop again). Otherwise the three channels order these
// patches differently, and the curves produce a color cast. All channels share the same blocks.
function poolNeutrals(neutrals: readonly Sample[]): Block[] {
  const level = (sample: Sample): number => mean(sample.target);
  const sorted = neutrals.toSorted((a, b) => level(a) - level(b));
  const blocks: Block[] = [];
  for (const sample of sorted) {
    blocks.push({
      ids: [sample.id],
      count: 1,
      linear: [...sample.linear],
      target: [...sample.target],
    });
    mergeFlatTop(blocks);
  }
  return blocks;
}

// Gain by which the camera is brighter (>1) or darker (<1) than the reference in the mid tones: the
// geometric mean, over the mid tones of the gray ramp, of the factor by which the camera level lies
// above the target. Scaling the reference by it keeps the exposure of the shot (only color cast and
// tone curve are corrected, not the brightness).
function exposureGain(blocks: readonly Block[]): number {
  const logs = blocks
    .filter((block) => targetLevel(block) >= EXPOSURE_FROM && targetLevel(block) <= EXPOSURE_TO)
    .map((block) => ({ level: blockLevel(block), target: targetLevel(block) }))
    .filter((entry) => entry.level > 0 && entry.target > 0)
    .map((entry) => Math.log(entry.level / entry.target));
  return logs.length === 0 ? 1 : Math.exp(mean(logs));
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

// Compresses a linear target value softly towards white above the shoulder (see SHOULDER).
function shoulder(value: number): number {
  return value <= SHOULDER
    ? value
    : SHOULDER + (1 - SHOULDER) * (1 - Math.exp(-(value - SHOULDER) / (1 - SHOULDER)));
}

// Shortens the part of `value` above `knee` by one factor so that `top`, the largest value that can
// occur, lands exactly on 1: values keep their order and their proportions, none is cut off. Nothing
// changes when `top` already fits.
function belowOne(value: number, knee: number, top: number): number {
  return value <= knee || top <= 1 ? value : knee + ((value - knee) * (1 - knee)) / (top - knee);
}

// Tone curve of a channel from the (camera value, target value) pairs of the gray ramp, both
// linear: the logarithm of the gain (target / camera) is a polynomial of the logarithm of the
// camera value. Beyond the measured range the gain stays constant at the edge value, and it is
// limited so that noise is not amplified without bounds. Where the camera's white would end above 1,
// the curve above the shoulder is shortened in proportion so that it ends exactly at 1: bright tones
// are not cut off.
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
  return { xs, ys: ys.map((y) => belowOne(y, SHOULDER, previous)) };
}

// Row-wise least-squares estimate of the matrix with the constraint row sum = 1 and
// weak regularization toward the identity matrix.
interface Pair {
  // Camera value (sRGB-encoded) and its tone curve output (linear).
  measured: Vec3;
  corrected: Vec3;
  target: Vec3;
  // Reference color (Lab) at the exposure of the shot.
  lab: Vec3;
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

// Matrix from its six free numbers (the third entry of each row follows from the row sum 1).
function matrixOf(free: readonly number[]): readonly [Vec3, Vec3, Vec3] {
  const row = (first: number, second: number): Vec3 => [first, second, 1 - first - second];
  const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0] = free;
  return [row(a, b), row(c, d), row(e, f)];
}

function chromaOf([, a, b]: Vec3): number {
  return Math.hypot(a, b);
}

// Free numbers of the identity matrix (see matrixOf).
const IDENTITY_FREE = [1, 0, 0, 1, 0, 0] as const;

// How far the luminance of the camera primaries falls short of MIN_PRIMARY_LUMINANCE (squared, summed).
function primaryShortfall(matrix: readonly [Vec3, Vec3, Vec3]): number {
  let sum = 0;
  for (const column of [0, 1, 2] as const) {
    const luminance =
      LUMINANCE[0] * matrix[0][column] +
      LUMINANCE[1] * matrix[1][column] +
      LUMINANCE[2] * matrix[2][column];
    sum += Math.max(0, MIN_PRIMARY_LUMINANCE * LUMINANCE[column] - luminance) ** 2;
  }
  return sum;
}

// Mean color deviation plus a penalty for colors that come out more saturated than the reference
// (by more than SATURATION_LIMIT): too much saturation looks worse than too little at the same
// deviation, and a matrix that makes blues glare is not a good compromise. The weak pull toward the
// identity (REFINE_RIDGE) keeps the matrix calm where the patches do not decide it, and camera
// primaries that would come out too dark are penalized (see MIN_PRIMARY_LUMINANCE).
function meanDeviation(free: readonly number[], goals: readonly Pair[]): number {
  const matrix = matrixOf(free);
  const deviation = mean(
    goals.map((goal) => {
      const lab = srgbToLab(towardsWhite(goal.measured, mixCode(matrix, goal.corrected)));
      const excess = Math.max(0, chromaOf(lab) - SATURATION_LIMIT * chromaOf(goal.lab));
      return deltaE2000(lab, goal.lab) + SATURATION_PENALTY * excess;
    }),
  );
  const pull = free.reduce(
    (sum, value, index) => sum + (value - Number(IDENTITY_FREE[index])) ** 2,
    0,
  );
  return deviation + REFINE_RIDGE * pull + PRIMARY_PENALTY * primaryShortfall(matrix);
}

// Nudges each of the six numbers up and down by `step` and keeps every change that lowers the
// deviation; returns whether anything improved.
function nudge(free: number[], step: number, goals: readonly Pair[]): boolean {
  let improved = false;
  let best = meanDeviation(free, goals);
  for (let index = 0; index < free.length; index++) {
    for (const direction of [step, -step]) {
      const trial = free.with(index, Number(free[index]) + direction);
      const value = meanDeviation(trial, goals);
      if (value < best) {
        best = value;
        free[index] = Number(trial[index]);
        improved = true;
      }
    }
  }
  return improved;
}

// Fine-tunes the matrix so that the mean color deviation (CIEDE2000) is smallest. The least-squares
// start works on linear light, where a dark channel of a saturated color hardly counts: yellows lose
// their blue difference, blues become too strong. Pattern search: the step shrinks when nothing
// improves any more.
function refineMatrix(
  start: readonly [Vec3, Vec3, Vec3],
  goals: readonly Pair[],
): readonly [Vec3, Vec3, Vec3] {
  const free = [start[0][0], start[0][1], start[1][0], start[1][1], start[2][0], start[2][1]];
  for (const step of REFINE_STEPS) {
    for (let sweep = 0; sweep < REFINE_SWEEPS && nudge(free, step, goals); sweep++) {
      // keep nudging with the same step as long as it helps
    }
  }
  return matrixOf(free);
}

const evaluators = new WeakMap<
  ColorModel,
  readonly [CurveFunction, CurveFunction, CurveFunction]
>();

type CurveFunction = (x: number) => number;

// Sends a linear camera color through the three channel curves.
function curveLinear(
  [fr, fg, fb]: readonly [CurveFunction, CurveFunction, CurveFunction],
  [r, g, b]: Vec3,
): Vec3 {
  return [fr(r), fg(g), fb(b)];
}

function curveFunctions(model: ColorModel): readonly [CurveFunction, CurveFunction, CurveFunction] {
  let functions = evaluators.get(model);
  if (functions === undefined) {
    functions = model.curves.map((curve) => createPchip(curve)) as unknown as readonly [
      CurveFunction,
      CurveFunction,
      CurveFunction,
    ];
    evaluators.set(model, functions);
  }
  return functions;
}

function toCode(value: number): number {
  return linearToSrgb(Math.min(Math.max(value, 0), 1));
}

function luminanceOf([r, g, b]: Vec3): number {
  return LUMINANCE[0] * r + LUMINANCE[1] * g + LUMINANCE[2] * b;
}

// How far a linear color lies from the gray of luminance `y` towards the edge of the sRGB cube: 0 is
// that gray, 1 the edge, more lies beyond it.
function reachOf(color: Vec3, y: number): number {
  return Math.max(...color.map((value) => (value < y ? (y - value) / y : (value - y) / (1 - y))));
}

// Keeps a mixed color inside the sRGB cube without cutting anything off. The camera colors on the way
// from the camera gray of the same luminance through the curve output `u` on to full saturation (a
// channel at 0) all end up on one ray of mixed colors from that gray, stretched in proportion by the
// matrix. Where the end of the ray would lie beyond the edge of the sRGB cube, the part beyond
// GAMUT_KNEE is shortened by one factor so that the end lands exactly on the edge: colors keep their
// order and their proportions, only a fully saturated camera color can reach the edge, and directions
// that fit stay as they are. Hue and brightness stay.
function withinGamut(u: Vec3, mixed: Vec3): Vec3 {
  const y = Math.min(Math.max(luminanceOf(mixed), 1e-9), 1 - 1e-9);
  const reach = reachOf(mixed, y);
  if (reach <= GAMUT_KNEE) {
    return mixed;
  }
  // How much further the camera ray goes beyond `u` until a channel reaches 0.
  const further = Math.min(...u.map((value) => (value < y ? y / (y - value) : Infinity)));
  const scale = belowOne(reach, GAMUT_KNEE, reach * further) / reach;
  return [y + (mixed[0] - y) * scale, y + (mixed[1] - y) * scale, y + (mixed[2] - y) * scale];
}

// Pulls a linear target color with negative channels into the sRGB cube by desaturating it towards
// the gray of the same luminance, onto the edge: the nearest color sRGB can show, with hue and
// brightness kept. Channels above 1 do not occur, as the targets are compressed below white.
function intoGamut([r, g, b]: Vec3): Vec3 {
  const low = Math.min(r, g, b);
  if (low >= 0) {
    return [r, g, b];
  }
  const luminance = Math.max(0.2126 * r + 0.7152 * g + 0.0722 * b, 0);
  const factor = luminance / (luminance - low);
  return [
    luminance + (r - luminance) * factor,
    luminance + (g - luminance) * factor,
    luminance + (b - luminance) * factor,
  ];
}

// The color the correction aims at for a reference color (Lab, D50), linear: at the exposure of the
// shot (`exposureGain`), compressed softly above the shoulder like the tone curves do, and pulled into
// the sRGB gamut. That is the best the correction can show: colors outside the gamut
// (such as the cyan 1F) or brighter than white cannot be reached, and measuring against them would
// count an unavoidable error and pull the matrix towards it.
function targetLinear(lab: Vec3, exposureGain: number): Vec3 {
  const [r, g, b] = labToLinearSrgb(lab);
  return intoGamut([
    shoulder(r * exposureGain),
    shoulder(g * exposureGain),
    shoulder(b * exposureGain),
  ]);
}

// The same target as Lab (D50). The report, the check with the gray cards and the preview show and
// measure against it.
export function targetLab(lab: Vec3, exposureGain: number): Vec3 {
  return xyzD50ToLab(linearSrgbToXyzD50(targetLinear(lab, exposureGain)));
}

// Mixes the curve outputs (linear) with the matrix, keeps the result inside the sRGB cube (see
// withinGamut) and returns the sRGB code.
function mixCode(matrix: readonly [Vec3, Vec3, Vec3], u: Vec3): Vec3 {
  const [a, b, c] = matrix;
  const mixed: Vec3 = [
    a[0] * u[0] + a[1] * u[1] + a[2] * u[2],
    b[0] * u[0] + b[1] * u[1] + b[2] * u[2],
    c[0] * u[0] + c[1] * u[1] + c[2] * u[2],
  ];
  const [r, g, blue] = withinGamut(u, mixed);
  return [toCode(r), toCode(g), toCode(blue)];
}

// Blends the corrected value (sRGB code) of a camera value close to clipping in all channels
// smoothly towards white (see CLIP_KNEE).
function towardsWhite(code: Vec3, corrected: Vec3): Vec3 {
  const darkest = Math.min(...code);
  if (darkest <= CLIP_KNEE) {
    return corrected;
  }
  const t = Math.min((darkest - CLIP_KNEE) / (1 - CLIP_KNEE), 1);
  const weight = t * t * (3 - 2 * t);
  const [r, g, b] = corrected;
  return [r + (1 - r) * weight, g + (1 - g) * weight, b + (1 - b) * weight];
}

// Applies the model to an sRGB-encoded camera value and returns the corrected value.
export function applyColorModel(model: ColorModel, code: Vec3): Vec3 {
  const linear: Vec3 = [srgbToLinear(code[0]), srgbToLinear(code[1]), srgbToLinear(code[2])];
  const mixed = mixCode(model.matrix, curveLinear(curveFunctions(model), linear));
  return towardsWhite(code, mixed);
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

function summarize(
  errors: readonly PatchError[],
  indistinct: string[],
  exposureGain: number,
): FitReport {
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
    exposureGain,
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
    buildCurve(
      blocks.map((block) => [
        Number(block.linear[channel]) / block.count,
        shoulder((gain * Number(block.target[channel])) / block.count),
      ]),
    ),
  ) as unknown as ColorModel['curves'];

  const draft: ColorModel = { curves, matrix: IDENTITY };
  const functions = curveFunctions(draft);
  const pairs = all.map((sample): Pair => ({
    measured: sample.measured,
    corrected: curveLinear(functions, sample.linear),
    target: targetLinear(sample.reference, gain),
    lab: targetLab(sample.reference, gain),
  }));
  const model: ColorModel = { curves, matrix: refineMatrix(fitMatrix(pairs), pairs) };

  const errors = all.map((sample): PatchError => {
    // The deviation is measured against the color the correction can show at best.
    const reference = targetLab(sample.reference, gain);
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
  return { model, report: summarize(errors, indistinct, gain) };
}
