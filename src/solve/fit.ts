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
// a 3×3 matrix whose rows sum to 1 (neutral stays neutral), extended by root terms where they
// describe the camera better (see rootTerms and chooseMixing).
export interface ColorModel {
  curves: readonly [Curve, Curve, Curve];
  matrix: readonly [Vec3, Vec3, Vec3];
  // Weight of each root term per output channel; missing for the matrix alone (and in projects
  // saved before the root terms existed).
  roots?: readonly [Vec3, Vec3, Vec3];
}

// How the curve outputs are mixed: the part of the model after the tone curves.
type Mixing = Pick<ColorModel, 'matrix' | 'roots'>;

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
  // Mean deviation of the color patches when each group of them is predicted by a fit without it, with
  // the matrix alone and with the root terms (see chooseMixing); null with too few color patches to
  // decide.
  crossCheck: { matrix: number; roots: number } | null;
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
// Without the tone correction the curve is a straight line up to this knee (at most this value after
// the factor), then it bends to white.
const PLAIN_KNEE = 0.5;
const PLAIN_KNEE_TOP = 0.9;
// Targets above the shoulder are compressed softly towards white: the exposure gain would otherwise
// push the bright gray patches beyond 1, and everything above them would clip.
const SHOULDER = 0.8;
// Highest saturation (Lab chroma) relative to the reference that the matrix fine-tuning allows
// without penalty, and the weight of the penalty above it.
const SATURATION_LIMIT = 1.1;
const SATURATION_PENALTY = 1;
const CURVE_POINTS = 48;
// Step sizes of the matrix fine-tuning and the maximum number of sweeps per step size.
const REFINE_STEPS = [0.1, 0.05, 0.02, 0.01, 0.004, 0.0015];
const REFINE_SWEEPS = 40;
// Number of groups of the cross-check: each group of color patches is predicted by a fit without it.
const CROSS_CHECK_GROUPS = 6;
// The cross-check only compares the two mixings: its fits leave out the two finest steps, which hardly
// change the result but take half of the time.
const CROSS_CHECK_STEPS = REFINE_STEPS.slice(0, -2);
// The root terms are only used when they predict the color patches better than the matrix alone by
// at least this much (mean ΔE2000), and only with enough color patches to tell that.
const ROOT_MARGIN = 0.1;
const MIN_ROOT_COLORS = 18;
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

// Geometric mean, over the mid tones of the gray ramp, of the factor by which the camera level
// (taken from `level`) lies above the target (taken from `target`).
function midGain(
  blocks: readonly Block[],
  level: (block: Block) => number,
  target: (block: Block) => number,
): number {
  const logs = blocks
    .filter((block) => targetLevel(block) >= EXPOSURE_FROM && targetLevel(block) <= EXPOSURE_TO)
    .map((block) => ({ level: level(block), target: target(block) }))
    .filter((entry) => entry.level > 0 && entry.target > 0)
    .map((entry) => Math.log(entry.level / entry.target));
  return logs.length === 0 ? 1 : Math.exp(mean(logs));
}

// Gain by which the camera is brighter (>1) or darker (<1) than the reference in the mid tones.
// Scaling the reference by it keeps the exposure of the shot (only color cast and tone curve are
// corrected, not the brightness).
function exposureGain(blocks: readonly Block[]): number {
  return midGain(blocks, blockLevel, targetLevel);
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

// Tone curve of a channel from the (camera value, target value) pairs of the gray ramp, both
// linear: the logarithm of the gain (target / camera) is a polynomial of the logarithm of the
// camera value. Beyond the measured range the gain stays constant at the edge value, and it is
// limited so that noise is not amplified without bounds.
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

// A patch as the mixing sees it.
interface Pair {
  // Camera value (sRGB-encoded) and its tone curve output (linear).
  measured: Vec3;
  corrected: Vec3;
  target: Vec3;
  // Reference color (Lab) at the exposure of the shot.
  lab: Vec3;
  neutral: boolean;
}

// The root terms of a root-polynomial color correction (Finlayson et al.) after the tone curves:
// √(rg), √(gb) and √(rb) describe how a camera mixes its channels beyond a matrix. Written as
// (√r − √g)² = r + g − 2√(rg) and so on, they vanish on the gray axis, so grays stay gray as long as
// the matrix rows sum to 1. Like the matrix they scale with the light: twice the light, twice the
// term, so they do not depend on the exposure.
function rootTerms([r, g, b]: Vec3): Vec3 {
  const [sr, sg, sb] = [Math.sqrt(r), Math.sqrt(g), Math.sqrt(b)];
  return [(sr - sg) ** 2, (sg - sb) ** 2, (sr - sb) ** 2];
}

// Row-wise least-squares estimate of the matrix with the constraint row sum = 1 and, if wanted, of
// the root weights, with weak regularization toward the identity matrix and root weights 0. Per row
// the unknowns are the first two matrix entries (the third follows from the row sum) and the three
// root weights.
function fitMixing(pairs: readonly Pair[], withRoots: boolean): Mixing {
  const lambda = RIDGE * pairs.length;
  const size = withRoots ? 5 : 2;
  const width = size + 1;
  const rows = IDENTITY.map((prior, row) => {
    const augmented: number[] = Array.from({ length: size * width }, () => 0);
    for (let k = 0; k < size; k++) {
      augmented[k * width + k] = lambda;
      augmented[k * width + size] = lambda * (k < 2 ? Number(prior[k]) : 0);
    }
    for (const { corrected: u, target } of pairs) {
      const x = [u[0] - u[2], u[1] - u[2], ...rootTerms(u)];
      const rest = Number(target[row]) - u[2];
      for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
          augmented[i * width + j] = Number(augmented[i * width + j]) + Number(x[i]) * Number(x[j]);
        }
        augmented[i * width + size] = Number(augmented[i * width + size]) + Number(x[i]) * rest;
      }
    }
    // The regularization keeps the system positive definite at all times.
    return solve(augmented, size);
  });
  return mixingOf([
    ...rows.flatMap((solution) => solution.slice(0, 2)),
    ...rows.flatMap((solution) => solution.slice(2)),
  ]);
}

// Without a tone curve each channel gets one factor (white balance) that brings its mid tones to
// the exposure of the shot, so contrast and gamma stay as they are. Only above the knee the curve
// bends so that it ends at white: a clipped white pixel must stay white, otherwise a factor below 1
// turns every blown-out highlight into a colored one.
function buildPlainCurve(blocks: readonly Block[], channel: number, gain: number): Curve {
  const level = (block: Block): number => Number(block.linear[channel]) / block.count;
  const target = (block: Block): number => Number(block.target[channel]) / block.count;
  const factor = Math.min(Math.max(gain / midGain(blocks, level, target), 1 / MAX_GAIN), MAX_GAIN);
  const knee = Math.min(PLAIN_KNEE, PLAIN_KNEE_TOP / factor);
  return { xs: [0, knee, 1], ys: [0, factor * knee, 1] };
}

// Matrix row from its first two entries (the third follows from the row sum 1).
function matrixRow(first: number, second: number): Vec3 {
  return [first, second, 1 - first - second];
}

// Mixing from its free numbers: six for the matrix (see matrixRow), then, with root terms, three root
// weights per row.
function mixingOf(free: readonly number[]): Mixing {
  const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0, ...weights] = free;
  const matrix: Mixing['matrix'] = [matrixRow(a, b), matrixRow(c, d), matrixRow(e, f)];
  if (weights.length === 0) {
    return { matrix };
  }
  const roots = (start: number): Vec3 => [
    Number(weights[start]),
    Number(weights[start + 1]),
    Number(weights[start + 2]),
  ];
  return { matrix, roots: [roots(0), roots(3), roots(6)] };
}

// Free numbers of a mixing (see mixingOf).
function freeOf({ matrix, roots }: Mixing): number[] {
  const free = [matrix[0][0], matrix[0][1], matrix[1][0], matrix[1][1], matrix[2][0], matrix[2][1]];
  return roots === undefined ? free : [...free, ...roots.flat()];
}

function chromaOf([, a, b]: Vec3): number {
  return Math.hypot(a, b);
}

// Free numbers of the identity matrix without root terms (see mixingOf); root weights are pulled
// toward 0.
const IDENTITY_FREE = [1, 0, 0, 1, 0, 0] as const;

// Corrected color (Lab) of a patch with the mixing. Away from white (see towardsWhite) it goes
// straight from linear light to Lab, without the detour over the sRGB code: the fine-tuning evaluates
// this very often, and the detour would double its time.
function mixedLab(mixing: Mixing, goal: Pair): Vec3 {
  const linear = mixLinear(mixing, goal.corrected);
  return nearWhite(goal.measured)
    ? srgbToLab(towardsWhite(goal.measured, codeOf(linear)))
    : xyzD50ToLab(linearSrgbToXyzD50(linear));
}

function deviationOf(mixing: Mixing, goal: Pair): number {
  return deltaE2000(mixedLab(mixing, goal), goal.lab);
}

// Mean color deviation plus a penalty for colors that come out more saturated than the reference
// (by more than SATURATION_LIMIT): too much saturation looks worse than too little at the same
// deviation, and a matrix that makes blues glare is not a good compromise. The weak pull toward the
// identity and root weights 0 (REFINE_RIDGE) keeps the mixing calm where the patches do not decide
// it.
function meanDeviation(free: readonly number[], goals: readonly Pair[]): number {
  const mixing = mixingOf(free);
  const deviation = mean(
    goals.map((goal) => {
      const lab = mixedLab(mixing, goal);
      const excess = Math.max(0, chromaOf(lab) - SATURATION_LIMIT * chromaOf(goal.lab));
      return deltaE2000(lab, goal.lab) + SATURATION_PENALTY * excess;
    }),
  );
  const pull = free.reduce(
    (sum, value, index) => sum + (value - (IDENTITY_FREE[index] ?? 0)) ** 2,
    0,
  );
  return deviation + REFINE_RIDGE * pull;
}

// Nudges each of the free numbers up and down by `step` and keeps every change that lowers the
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

// Fine-tunes the mixing so that the mean color deviation (CIEDE2000) is smallest. The least-squares
// start works on linear light, where a dark channel of a saturated color hardly counts: yellows lose
// their blue difference, blues become too strong. Pattern search: the step shrinks when nothing
// improves any more.
function refineMixing(start: Mixing, goals: readonly Pair[], steps = REFINE_STEPS): Mixing {
  const free = freeOf(start);
  for (const step of steps) {
    for (let sweep = 0; sweep < REFINE_SWEEPS && nudge(free, step, goals); sweep++) {
      // keep nudging with the same step as long as it helps
    }
  }
  return mixingOf(free);
}

function fitWith(pairs: readonly Pair[], withRoots: boolean, steps = REFINE_STEPS): Mixing {
  return refineMixing(fitMixing(pairs, withRoots), pairs, steps);
}

// Mean deviation of the color patches when each group of them is predicted by a fit without it. Each
// such fit starts from scratch: starting from the fit with all patches would let it keep what it
// learned from the left-out patches.
function crossCheck(pairs: readonly Pair[], withRoots: boolean): number {
  const colored = pairs.filter((pair) => !pair.neutral);
  const errors = Array.from({ length: CROSS_CHECK_GROUPS }, (_, group) => {
    const held = new Set(colored.filter((_, index) => index % CROSS_CHECK_GROUPS === group));
    const partial = fitWith(
      pairs.filter((pair) => !held.has(pair)),
      withRoots,
      CROSS_CHECK_STEPS,
    );
    return [...held].map((goal) => deviationOf(partial, goal));
  });
  return mean(errors.flat());
}

// The matrix alone or with the root terms. The root terms follow a camera that mixes its channels
// in a nonlinear way, but with nine more numbers they can also follow the measurement noise of single
// patches and then predict other colors worse. The cross-check decides: the root terms are only used
// when they predict the color patches better (by ROOT_MARGIN).
function chooseMixing(pairs: readonly Pair[]): { mixing: Mixing; check: FitReport['crossCheck'] } {
  const matrix = fitWith(pairs, false);
  if (pairs.filter((pair) => !pair.neutral).length < MIN_ROOT_COLORS) {
    return { mixing: matrix, check: null };
  }
  const check = { matrix: crossCheck(pairs, false), roots: crossCheck(pairs, true) };
  return {
    mixing: check.roots < check.matrix - ROOT_MARGIN ? fitWith(pairs, true) : matrix,
    check,
  };
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

function codeOf([r, g, b]: Vec3): Vec3 {
  return [linearToSrgb(r), linearToSrgb(g), linearToSrgb(b)];
}

function unit(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

// Pulls a linear color with negative channels back into the sRGB cube by desaturating it towards the
// gray of the same luminance: hue and brightness stay, instead of single channels clipping at 0 and a
// saturated color (a blue light, for example) turning harsh and glaring. Channels above 1 are simply
// clipped, as a color that bright cannot keep its saturation anyway.
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
// the sRGB gamut like the output. That is the best the correction can show: colors outside the gamut
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

const NO_ROOTS: readonly [Vec3, Vec3, Vec3] = [
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
];

// Mixes the curve outputs (linear) with the matrix and the root terms; the result lies in the sRGB
// cube (linear).
function mixLinear({ matrix, roots = NO_ROOTS }: Mixing, u: Vec3): Vec3 {
  const h = rootTerms(u);
  const mix = (row: Vec3, weights: Vec3): number =>
    row[0] * u[0] +
    row[1] * u[1] +
    row[2] * u[2] +
    weights[0] * h[0] +
    weights[1] * h[1] +
    weights[2] * h[2];
  const [r, g, blue] = intoGamut([
    mix(matrix[0], roots[0]),
    mix(matrix[1], roots[1]),
    mix(matrix[2], roots[2]),
  ]);
  return [unit(r), unit(g), unit(blue)];
}

// Whether a camera value (sRGB code) is close to clipping in all channels (see CLIP_KNEE).
function nearWhite(code: Vec3): boolean {
  return Math.min(...code) > CLIP_KNEE;
}

// Blends the corrected value (sRGB code) of a camera value close to clipping in all channels
// smoothly towards white (see CLIP_KNEE).
function towardsWhite(code: Vec3, corrected: Vec3): Vec3 {
  if (!nearWhite(code)) {
    return corrected;
  }
  const t = Math.min((Math.min(...code) - CLIP_KNEE) / (1 - CLIP_KNEE), 1);
  const weight = t * t * (3 - 2 * t);
  const [r, g, b] = corrected;
  return [r + (1 - r) * weight, g + (1 - g) * weight, b + (1 - b) * weight];
}

// Applies the model to an sRGB-encoded camera value and returns the corrected value.
export function applyColorModel(model: ColorModel, code: Vec3): Vec3 {
  const linear: Vec3 = [srgbToLinear(code[0]), srgbToLinear(code[1]), srgbToLinear(code[2])];
  const mixed = mixLinear(model, curveLinear(curveFunctions(model), linear));
  return towardsWhite(code, codeOf(mixed));
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
  crossCheck: FitReport['crossCheck'],
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
    crossCheck,
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
    neutral: sample.isNeutral,
  }));
  const { mixing, check } = chooseMixing(pairs);
  const model: ColorModel = { curves, ...mixing };

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
  return { model, report: summarize(errors, indistinct, gain, check) };
}
