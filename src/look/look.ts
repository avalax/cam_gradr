import type { Vec3 } from '../color/lab';
import { CHANNELS } from '../color/srgb';
import { MAX_SIZE, MIN_SIZE, sampleLut } from '../lut/lut';
import type { Lut } from '../lut/lut';

// A look LUT: a ready-made 3D LUT from a .cube file (for example a cinema look) that is laid over
// the correction. Its input is the corrected image in sRGB / Rec.709 code values; DOMAIN_MIN and
// DOMAIN_MAX of the file give the input range its grid spans.
export interface LookLut {
  name: string;
  lut: Lut;
  min: Vec3;
  max: Vec3;
}

const CUBE_EXTENSION = /\.cube$/i;
// Names of conversions from the log curves of cameras (S-Log, LogC, V-Log, C-Log, F-Log, N-Log,
// D-Log, Log3G). Such a LUT expects a log signal, a webcam delivers Rec.709 already.
const LOG_NAME = /s-?log|log-?c|v-?log|c-?log|f-?log|n-?log|d-?log|log-?3g/i;

// What makes a file unusable as a look LUT: the key of its text in the language files
// (look.errors) with the values to fill in. The bar translates it when it shows it, so that it
// follows a language switch.
export interface LookProblem {
  key:
    | 'notCube'
    | 'oneDimensional'
    | 'noSize'
    | 'size'
    | 'numbers'
    | 'count'
    | 'domain'
    | 'parseFailed';
  params: Record<string, string | number>;
}

// The error of the parser: it names the problem, which the bar translates.
export class LookError extends Error {
  constructor(readonly problem: LookProblem) {
    super(problem.key);
  }
}

// The problem the parser names. Anything else it throws is a bug: the console gets it as it is, the
// user a file that could not be processed, so that the message never stays empty.
export function lookProblem(error: unknown): LookProblem {
  if (error instanceof LookError) {
    return error.problem;
  }
  console.error(error);
  return { key: 'parseFailed', params: {} };
}

export function isCubeFile(fileName: string): boolean {
  return CUBE_EXTENSION.test(fileName);
}

// The look is named after its file: the TITLE in look files is often missing or only names the
// program that wrote it.
export function lookName(fileName: string): string {
  const name = fileName.replace(CUBE_EXTENSION, '');
  return name === '' ? fileName : name;
}

export function isLogConversion(name: string): boolean {
  return LOG_NAME.test(name);
}

// The first `count` entries of a line as numbers; anything else breaks the file.
function numbers(parts: readonly string[], line: number, count: number): number[] {
  const values = parts.slice(0, count).map(Number);
  if (parts.length < count || values.some((value) => !Number.isFinite(value))) {
    throw new LookError({ key: 'numbers', params: { line } });
  }
  return values;
}

function triple(parts: readonly string[], line: number): Vec3 {
  return numbers(parts, line, CHANNELS) as unknown as Vec3;
}

function lutSize(value: string | undefined): number {
  const size = Number(value);
  if (!Number.isSafeInteger(size) || size < MIN_SIZE || size > MAX_SIZE) {
    throw new LookError({
      key: 'size',
      params: { size: String(value), min: MIN_SIZE, max: MAX_SIZE },
    });
  }
  return size;
}

// What has been read of a .cube file so far.
interface CubeState {
  size: number;
  data: Float32Array | null;
  count: number;
  min: Vec3;
  max: Vec3;
}

type KeywordReader = (state: CubeState, rest: readonly string[], line: number) => void;

// The keywords of the format; others (TITLE and the additions of programs) are skipped.
const KEYWORDS = new Map<string, KeywordReader>([
  [
    'LUT_1D_SIZE',
    () => {
      throw new LookError({ key: 'oneDimensional', params: {} });
    },
  ],
  [
    'LUT_3D_SIZE',
    (state, rest) => {
      state.size = lutSize(rest[0]);
      state.data = new Float32Array(state.size ** 3 * CHANNELS);
    },
  ],
  [
    'DOMAIN_MIN',
    (state, rest, line) => {
      state.min = triple(rest, line);
    },
  ],
  [
    'DOMAIN_MAX',
    (state, rest, line) => {
      state.max = triple(rest, line);
    },
  ],
  // The older form of the input range, one pair for all three channels.
  [
    'LUT_3D_INPUT_RANGE',
    (state, rest, line) => {
      const [low = 0, high = 1] = numbers(rest, line, 2);
      state.min = [low, low, low];
      state.max = [high, high, high];
    },
  ],
]);

function readValues(state: CubeState, parts: readonly string[], line: number): void {
  if (state.data === null) {
    throw new LookError({ key: 'noSize', params: {} });
  }
  const values = triple(parts, line);
  if (state.count < state.size ** 3) {
    state.data.set(values, state.count * CHANNELS);
  }
  state.count += 1;
}

function readLine(state: CubeState, raw: string, line: number): void {
  const text = raw.trim();
  if (text === '' || text.startsWith('#')) {
    return;
  }
  const parts = text.split(/\s+/);
  // A trimmed line that is not empty has at least one part.
  const keyword = String(parts[0]);
  const reader = KEYWORDS.get(keyword.toUpperCase());
  if (reader !== undefined) {
    reader(state, parts.slice(1), line);
  } else if (/^[-+.\d]/.test(keyword)) {
    readValues(state, parts, line);
  }
}

// Reads a 3D LUT in the .cube format (Adobe/Resolve). 1D LUTs and broken files are rejected with
// an understandable message; unknown keywords are skipped, as programs add their own.
export function parseLookCube(fileName: string, text: string): LookLut {
  const state: CubeState = { size: 0, data: null, count: 0, min: [0, 0, 0], max: [1, 1, 1] };
  for (const [index, raw] of text.split(/\r?\n/).entries()) {
    readLine(state, raw, index + 1);
  }
  const { size, data, count, min, max } = state;
  if (data === null) {
    throw new LookError({ key: 'noSize', params: {} });
  }
  if (count !== size ** 3) {
    throw new LookError({ key: 'count', params: { expected: size ** 3, actual: count } });
  }
  if (min.some((low, axis) => low >= max[axis as 0 | 1 | 2])) {
    throw new LookError({ key: 'domain', params: {} });
  }
  return { name: lookName(fileName), lut: { size, data }, min, max };
}

// The look applied to one sRGB code value (trilinear, as for the correction).
export function sampleLook(look: LookLut, rgb: Vec3): Vec3 {
  const scaled = rgb.map((value, axis) => {
    const low = look.min[axis as 0 | 1 | 2];
    return (value - low) / (look.max[axis as 0 | 1 | 2] - low);
  });
  return sampleLut(look.lut, scaled as unknown as Vec3);
}

// Passes every grid point of a LUT (the correction) through the look: a LUT of the same size that
// first corrects and then applies the look in full.
export function applyLook(base: Lut, look: LookLut): Lut {
  const data = new Float32Array(base.data.length);
  for (let offset = 0; offset < data.length; offset += CHANNELS) {
    const looked = sampleLook(look, [
      Number(base.data[offset]),
      Number(base.data[offset + 1]),
      Number(base.data[offset + 2]),
    ]);
    data.set(looked, offset);
  }
  return { size: base.size, data };
}

// The strength of the look: base + amount × (look − base), with 0 the correction alone and 1 the
// full look. Because sampling interpolates linearly, the mixed LUT gives the mixed image.
export function blendLuts(base: Lut, looked: Lut, amount: number): Lut {
  const data = new Float32Array(base.data.length);
  for (const [index, value] of base.data.entries()) {
    data[index] = value + amount * (Number(looked.data[index]) - value);
  }
  return { size: base.size, data };
}

// The same for a single color, as the export shows it in its slices.
export function blendColor(base: Vec3, looked: Vec3, amount: number): Vec3 {
  return base.map(
    (value, axis) => value + amount * (looked[axis as 0 | 1 | 2] - value),
  ) as unknown as Vec3;
}

// Part of a file name for the look: lower case, without accents, other characters as hyphens.
export function lookSlug(name: string): string {
  return name
    .normalize('NFKD')
    .replaceAll(/\p{M}/gu, '')
    .toLowerCase()
    .replaceAll(/[^a-z\d]+/g, '-')
    .replaceAll(/^-|-$/g, '');
}

// The correction LUT with the look at the given strength (0..1); without a look it stays as is.
export function lookedLut(base: Lut, look: LookLut | null, amount: number): Lut {
  return look === null ? base : blendLuts(base, applyLook(base, look), amount);
}
