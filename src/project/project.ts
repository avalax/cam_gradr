import { isRecord } from '../chart/layout';
import { COLOR_IDS, GRAY_IDS, colorLayout, grayLayout } from '../chart/layouts';
import type { ChartLayout, Point, Rgb } from '../chart/types';
import { t } from '../lang';
import type { StillKey } from '../camera/camera-store';
import { HUE_COEFFICIENTS } from '../solve/fit';
import type { ColorModel } from '../solve/fit';
import { CUBE_SIZES } from '../lut/cube';
import type { CubeSize } from '../lut/cube';
import { MAX_SIZE, MIN_SIZE } from '../lut/lut';
import type { Side } from '../lut/preview-store';

import { FRAME_ENCODING } from './frame-codec';
import type { EncodedFrame } from './frame-codec';
import { LOOK_ENCODING } from './look-codec';
import type { EncodedLook } from './look-codec';

export const PROJECT_FORMAT = 'cam_gradr-project/2';

// State of a card group: corner points set per card and measured camera values per field.
interface ChartState {
  corners: Record<number, Point[]>;
  measurements: Record<string, Rgb>;
  // Cards held rotated by 180°.
  rotated: boolean;
}

// The look LUTs of a project with everything the preview and the export set for them ("Include look
// LUTs"). A file without them loads as if there had never been a look LUT. The export takes what the
// preview shows, so it needs nothing of its own here.
export interface LookSettings {
  // The look LUT the preview shows and the export lays over the correction, or none.
  chosen: string | null;
  // Strength in percent.
  strength: number;
  // What the two sides of the preview start from.
  left: Side;
  right: Side;
  // All imported look LUTs with their data.
  luts: EncodedLook[];
}

export interface Project {
  format: typeof PROJECT_FORMAT;
  savedAt: string;
  gray: ChartState;
  color: ChartState & { reference: string | null };
  // The computed correction model; reference values (manufacturer data) are deliberately not saved.
  model: ColorModel | null;
  // Position of the preview's divider in percent.
  preview: { split: number };
  export: { size: CubeSize };
  // Still images per tab; missing in files that were saved without images.
  stills?: Partial<Record<StillKey, EncodedFrame>>;
  looks?: LookSettings;
}

const STILL_KEYS: ReadonlySet<string> = new Set(['gray', 'color', 'preview']);
const SIDES: ReadonlySet<unknown> = new Set<Side>(['camera', 'corrected']);
const SIZES: ReadonlySet<unknown> = new Set<CubeSize>(CUBE_SIZES);
const MAX_STILL_SIDE = 16_384;

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function triple(value: unknown, where: string): number[] {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(isNumber)) {
    throw new TypeError(t('project.errors.triple', { where }));
  }
  return value;
}

function parsePoint(value: unknown, where: string): Point {
  if (!isRecord(value) || !isNumber(value.x) || !isNumber(value.y)) {
    throw new TypeError(t('project.errors.pointXY', { where }));
  }
  return { x: value.x, y: value.y };
}

function parseCorners(
  value: Record<string, unknown>,
  where: string,
  layout: ChartLayout,
): Record<number, Point[]> {
  const corners: Record<number, Point[]> = {};
  for (const [key, list] of Object.entries(value)) {
    if (layout.cards.every((card) => card.card !== Number(key))) {
      throw new RangeError(t('project.errors.unknownCard', { where, key }));
    }
    if (!Array.isArray(list) || list.length > 4) {
      throw new RangeError(t('project.errors.badCornerList', { where, key }));
    }
    corners[Number(key)] = list.map((point) =>
      parsePoint(point, t('project.errors.cardWhere', { where, key })),
    );
  }
  return corners;
}

function parseMeasurements(
  value: Record<string, unknown>,
  where: string,
  ids: ReadonlySet<string>,
): Record<string, Rgb> {
  const measurements: Record<string, Rgb> = {};
  for (const [id, rgb] of Object.entries(value)) {
    if (!ids.has(id)) {
      throw new RangeError(t('project.errors.unknownField', { where, id }));
    }
    const [r = 0, g = 0, b = 0] = triple(rgb, t('project.errors.fieldWhere', { where, id }));
    if ([r, g, b].some((channel) => channel < 0 || channel > 1)) {
      throw new RangeError(t('project.errors.fieldRange', { where, id }));
    }
    measurements[id] = [r, g, b];
  }
  return measurements;
}

function parseChart(
  value: unknown,
  where: string,
  layout: ChartLayout,
  ids: ReadonlySet<string>,
): ChartState {
  if (
    !isRecord(value) ||
    !isRecord(value.corners) ||
    !isRecord(value.measurements) ||
    typeof value.rotated !== 'boolean'
  ) {
    throw new TypeError(t('project.errors.chartShape', { where }));
  }
  return {
    corners: parseCorners(value.corners, where, layout),
    measurements: parseMeasurements(value.measurements, where, ids),
    rotated: value.rotated,
  };
}

function parseCurve(value: unknown, index: number): { xs: number[]; ys: number[] } {
  const where = t('project.errors.curveWhere', { index: String(index + 1) });
  if (!isRecord(value) || !Array.isArray(value.xs) || !Array.isArray(value.ys)) {
    throw new TypeError(t('project.errors.curveShape', { where }));
  }
  const { xs, ys } = value;
  if (
    xs.length < 2 ||
    xs.length !== ys.length ||
    !xs.every(isNumber) ||
    !ys.every(isNumber) ||
    xs.some((x, position) => position > 0 && x <= Number(xs[position - 1]))
  ) {
    throw new RangeError(t('project.errors.curvePoints', { where }));
  }
  return { xs, ys };
}

function parseHue(value: unknown): number[] {
  if (!Array.isArray(value) || value.length !== HUE_COEFFICIENTS || !value.every(isNumber)) {
    throw new TypeError(t('project.errors.hueShape', { count: HUE_COEFFICIENTS }));
  }
  return value;
}

function parseModel(value: unknown): ColorModel | null {
  if (value === null) {
    return null;
  }
  if (!isRecord(value) || !Array.isArray(value.curves) || value.curves.length !== 3) {
    throw new TypeError(t('project.errors.modelShape'));
  }
  const [c1, c2, c3] = value.curves.map((curve, index) => parseCurve(curve, index));
  if (!Array.isArray(value.matrix) || value.matrix.length !== 3) {
    throw new TypeError(t('project.errors.matrixRows'));
  }
  const [r1, r2, r3] = value.matrix.map((row) => triple(row, t('project.errors.matrixWhere')));
  return {
    curves: [c1, c2, c3] as unknown as ColorModel['curves'],
    matrix: [r1, r2, r3] as unknown as ColorModel['matrix'],
    hue: parseHue(value.hue),
  };
}

function parsePercent(value: unknown, name: string): number {
  if (!isNumber(value) || value < 0 || value > 100) {
    throw new RangeError(t('project.errors.percentRange', { name }));
  }
  return value;
}

// Checks the frame of a saved look LUT; whether its data unpack is checked when loading.
function parseLookData(value: unknown): EncodedLook {
  if (
    !isRecord(value) ||
    typeof value.name !== 'string' ||
    value.encoding !== LOOK_ENCODING ||
    typeof value.data !== 'string' ||
    !Number.isSafeInteger(value.size) ||
    Number(value.size) < MIN_SIZE ||
    Number(value.size) > MAX_SIZE
  ) {
    throw new TypeError(t('project.errors.lookData'));
  }
  const where = t('project.errors.lookWhere', { name: value.name });
  return {
    name: value.name,
    size: Number(value.size),
    min: triple(value.min, where) as unknown as EncodedLook['min'],
    max: triple(value.max, where) as unknown as EncodedLook['max'],
    encoding: LOOK_ENCODING,
    data: value.data,
  };
}

// The fields of the look section and their kinds; the values themselves are checked after.
type LookFields = Record<string, unknown> & {
  chosen: string | null;
  luts: unknown[];
};

function hasLookFields(value: unknown): value is LookFields {
  return (
    isRecord(value) &&
    (value.chosen === null || typeof value.chosen === 'string') &&
    SIDES.has(value.left) &&
    SIDES.has(value.right) &&
    Array.isArray(value.luts)
  );
}

function parseLooks(value: unknown): LookSettings | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!hasLookFields(value)) {
    throw new TypeError(t('project.errors.looksShape'));
  }
  const luts = value.luts.map((entry) => parseLookData(entry));
  const names = new Set(luts.map((lut) => lut.name));
  if (names.size !== luts.length) {
    throw new RangeError(t('project.errors.looksTwice'));
  }
  if (value.chosen !== null && !names.has(value.chosen)) {
    throw new RangeError(t('project.errors.looksChosen', { name: value.chosen }));
  }
  return {
    chosen: value.chosen,
    strength: parsePercent(value.strength, t('project.errors.strengthName')),
    left: value.left as Side,
    right: value.right as Side,
    luts,
  };
}

function parseExport(value: unknown): { size: CubeSize } {
  if (!isRecord(value) || !SIZES.has(value.size)) {
    throw new TypeError(t('project.errors.exportSize', { sizes: CUBE_SIZES.join(', ') }));
  }
  return { size: value.size as CubeSize };
}

function parseStill(value: unknown, key: string): EncodedFrame {
  const where = t('project.errors.stillWhere', { key });
  if (!isRecord(value) || value.encoding !== FRAME_ENCODING || typeof value.data !== 'string') {
    throw new TypeError(t('project.errors.stillEncoding', { where }));
  }
  const { width, height } = value;
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    Number(width) < 1 ||
    Number(height) < 1 ||
    Number(width) > MAX_STILL_SIDE ||
    Number(height) > MAX_STILL_SIDE
  ) {
    throw new RangeError(t('project.errors.stillSize', { where }));
  }
  return {
    width: Number(width),
    height: Number(height),
    encoding: FRAME_ENCODING,
    data: value.data,
  };
}

function parseStills(value: unknown): Partial<Record<StillKey, EncodedFrame>> | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    throw new TypeError(t('project.errors.stillsObject'));
  }
  const stills: Partial<Record<StillKey, EncodedFrame>> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!STILL_KEYS.has(key)) {
      throw new RangeError(t('project.errors.stillsTab', { key }));
    }
    stills[key as StillKey] = parseStill(entry, key);
  }
  return stills;
}

// The parts that are only in the file when they were chosen: still images and look LUTs.
function parseExtras(raw: Record<string, unknown>): Pick<Project, 'stills' | 'looks'> {
  const stills = parseStills(raw.stills);
  const looks = parseLooks(raw.looks);
  return { ...(stills !== undefined && { stills }), ...(looks !== undefined && { looks }) };
}

// Validates a project file and returns typed data; errors have understandable messages.
export function parseProject(text: string): Project {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new SyntaxError(t('project.errors.invalidJson'), { cause: error });
  }
  if (!isRecord(raw) || raw.format !== PROJECT_FORMAT) {
    throw new TypeError(t('project.errors.unknownFormat', { format: PROJECT_FORMAT }));
  }
  if (typeof raw.savedAt !== 'string') {
    throw new TypeError(t('project.errors.savedAt'));
  }
  const color = parseChart(raw.color, t('project.errors.chartColor'), colorLayout, COLOR_IDS);
  // parseChart has already checked that raw.color is an object.
  const reference = (raw.color as Record<string, unknown>).reference;
  if (reference !== null && typeof reference !== 'string') {
    throw new TypeError(t('project.errors.colorReference'));
  }
  if (!isRecord(raw.preview)) {
    throw new TypeError(t('project.errors.previewMissing'));
  }
  return {
    format: PROJECT_FORMAT,
    savedAt: raw.savedAt,
    gray: parseChart(raw.gray, t('project.errors.chartGray'), grayLayout, GRAY_IDS),
    color: { ...color, reference },
    model: parseModel(raw.model),
    preview: { split: parsePercent(raw.preview.split, t('project.errors.splitName')) },
    export: parseExport(raw.export),
    ...parseExtras(raw),
  };
}

export function serializeProject(project: Project): string {
  return `${JSON.stringify(project, null, 2)}\n`;
}
