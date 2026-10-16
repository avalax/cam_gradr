import { deltaE2000, labToLinearSrgb, labToXyzD50, srgbToLab } from '../color/lab';
import type { Vec3 } from '../color/lab';
import { linearToSrgb, srgbToLinear } from '../color/srgb';
import type { Rgb } from '../chart/types';
import type { ReferenceSet } from '../reference/reference';

import { createPchip } from './pchip';
import type { Curve } from './pchip';

// Korrekturmodell: je Kanal eine Tonkurve (inklusive Weißabgleich) auf linearen Werten, danach
// eine 3×3-Matrix, deren Zeilen sich zu 1 summieren (Neutral bleibt neutral).
export interface ColorModel {
  curves: readonly [Curve, Curve, Curve];
  matrix: readonly [Vec3, Vec3, Vec3];
}

interface PatchError {
  id: string;
  // Soll-Farbe (Lab, D50) und gemessener Kamerawert (sRGB-codiert) des Feldes.
  reference: Vec3;
  measured: Rgb;
  before: number;
  after: number;
}

interface FitReport {
  patches: PatchError[];
  meanBefore: number;
  meanAfter: number;
  maxBefore: number;
  maxAfter: number;
}

export interface FitResult {
  model: ColorModel;
  report: FitReport;
}

export interface FitInput {
  // Gemessene Kamerawerte (sRGB-codiert, 0..1) je Feld-ID.
  measurements: Readonly<Record<string, Rgb>>;
  reference: ReferenceSet;
  neutralIds: ReadonlySet<string>;
}

const MIN_NEUTRAL = 4;
const MIN_PATCHES = 8;
// Stärke der Regularisierung der Matrix zur Einheitsmatrix (relativ zur Feldanzahl).
const RIDGE = 1e-3;
const SAME_X = 1e-6;
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
        // Neutralfelder haben als Ziel ein reines Grau gleicher Helligkeit.
        target: isNeutral ? [gray, gray, gray] : labToLinearSrgb(lab),
        isNeutral,
      });
    }
  }
  return result;
}

// Stützpunkte einer Kanalkurve: Neutralfelder sortiert, gleiche x gemittelt, y nie fallend,
// zusätzlich die Ankerpunkte (0, 0) und (1, 1), damit die ganze Skala abgedeckt ist.
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

// Zeilenweise Kleinste-Quadrate-Schätzung der Matrix mit Nebenbedingung Zeilensumme = 1 und
// schwacher Regularisierung zur Einheitsmatrix.
interface Pair {
  corrected: Vec3;
  target: Vec3;
}

// Zeilenweise Kleinste-Quadrate-Schätzung der Matrix mit Nebenbedingung Zeilensumme = 1 und
// schwacher Regularisierung zur Einheitsmatrix.
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
    // Die Regularisierung hält die Determinante stets deutlich über 0.
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

// Wendet das Modell auf einen sRGB-codierten Kamerawert an und liefert den korrigierten Wert.
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

function summarize(errors: readonly PatchError[]): FitReport {
  const before = errors.map((error) => error.before);
  const after = errors.map((error) => error.after);
  return {
    patches: [...errors],
    meanBefore: mean(before),
    meanAfter: mean(after),
    maxBefore: Math.max(...before),
    maxAfter: Math.max(...after),
  };
}

export function fitColorModel(input: FitInput): FitResult {
  const all = samples(input);
  const neutrals = all.filter((sample) => sample.isNeutral);
  if (all.length < MIN_PATCHES || neutrals.length < MIN_NEUTRAL) {
    throw new RangeError(
      `Zu wenige Messwerte: mindestens ${String(MIN_PATCHES)} Felder, davon ${String(MIN_NEUTRAL)} neutrale`,
    );
  }
  const curves = [0, 1, 2].map((channel) =>
    buildCurve(neutrals.map((sample) => [Number(sample.linear[channel]), sample.target[0]])),
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
      before: deltaE2000(srgbToLab(sample.measured), sample.reference),
      after: deltaE2000(srgbToLab(applyColorModel(model, sample.measured)), sample.reference),
    };
  });
  return { model, report: summarize(errors) };
}
