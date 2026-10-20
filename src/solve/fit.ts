import { t } from '../lang';
import { deltaE2000, labToLinearSrgb, labToXyzD50, srgbToLab } from '../color/lab';
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
}

const MIN_NEUTRAL = 4;
const MIN_PATCHES = 8;
// Strength of the regularization of the matrix toward the identity (relative to the patch
// count).
const RIDGE = 1e-3;
const SAME_X = 1e-6;
// Below this slope of the camera response curve (camera value per target value, ideally about 1)
// the camera can hardly distinguish neighboring neutral patches: they then count as one block.
const MIN_RESPONSE_SLOPE = 0.1;
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

// Control points of a channel curve: neutral patches sorted, equal x averaged, y never falling,
// plus the anchor points (0, 0) and (1, 1) so that the whole scale is covered.
function buildCurve(points: readonly (readonly [number, number])[]): Curve {
  const sorted = points.toSorted((a, b) => a[0] - b[0]);
  const merged: [number, number, number][] = [];
  for (const [x, y] of sorted) {
    const previous = merged.at(-1);
    if (previous !== undefined && x - previous[0] < SAME_X) {
      previous[1] += y;
      previous[2] += 1;
    } else {
      merged.push([x, y, 1]);
    }
  }
  const xs: number[] = [];
  const ys: number[] = [];
  const addPoint = (x: number, y: number): void => {
    xs.push(x);
    ys.push(Math.max(y, ys.at(-1) ?? 0));
  };
  if (Number(merged[0]?.[0]) > 0) {
    addPoint(0, 0);
  }
  for (const [x, sum, count] of merged) {
    addPoint(x, sum / count);
  }
  if (Number(xs.at(-1)) < 1) {
    addPoint(1, 1);
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
  const curves = [0, 1, 2].map((channel) =>
    buildCurve(
      blocks.map((block) => [
        Number(block.linear[channel]) / block.count,
        block.target / block.count,
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
    target: sample.target,
  }));
  const model: ColorModel = { curves, matrix: fitMatrix(pairs) };

  const errors = all.map((sample): PatchError => {
    return {
      id: sample.id,
      reference: sample.reference,
      measured: sample.measured,
      neutral: sample.isNeutral,
      before: deltaE2000(srgbToLab(sample.measured), sample.reference),
      after: deltaE2000(srgbToLab(applyColorModel(model, sample.measured)), sample.reference),
    };
  });
  const indistinct = blocks.filter((block) => block.count > 1).flatMap((block) => block.ids);
  return { model, report: summarize(errors, indistinct) };
}
