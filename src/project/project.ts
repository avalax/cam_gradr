import { COLOR_IDS, grayLayout } from '../chart/layouts';
import type { Point, Rgb } from '../chart/types';
import { t } from '../lang';
import type { StillKey } from '../camera/camera-store';
import type { ColorModel } from '../solve/fit';

import { FRAME_ENCODING } from './frame-codec';
import type { EncodedFrame } from './frame-codec';

export const PROJECT_FORMAT = 'cam_gradr-project/1';

const GRAY_IDS: ReadonlySet<string> = new Set(
  grayLayout.cards.flatMap((card) => card.patches.map((patch) => patch.id)),
);
const GRAY_CARDS = [3, 4];
const COLOR_CARDS = [1, 2];

// State of a card group: corner points set per card and measured camera values per field.
interface ChartState {
  corners: Record<number, Point[]>;
  measurements: Record<string, Rgb>;
  // Cards held rotated by 180° (missing in older project files).
  rotated: boolean;
}

export interface Project {
  format: typeof PROJECT_FORMAT;
  savedAt: string;
  gray: ChartState;
  color: ChartState & { reference: string | null };
  // The computed correction model; reference values (manufacturer data) are deliberately not saved.
  model: ColorModel | null;
  // Whether contrast and gamma were corrected too; files without the entry did (true).
  tone: boolean;
  preview: { split: number };
  // Still images per tab; missing in files that were saved without images.
  stills?: Partial<Record<StillKey, EncodedFrame>>;
}

const STILL_KEYS: ReadonlySet<string> = new Set(['gray', 'color', 'preview']);
const MAX_STILL_SIDE = 16_384;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

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
  cards: number[],
): Record<number, Point[]> {
  const corners: Record<number, Point[]> = {};
  for (const [key, list] of Object.entries(value)) {
    if (!cards.includes(Number(key))) {
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
  cards: number[],
  ids: ReadonlySet<string>,
): ChartState {
  if (!isRecord(value) || !isRecord(value.corners) || !isRecord(value.measurements)) {
    throw new TypeError(t('project.errors.chartShape', { where }));
  }
  return {
    corners: parseCorners(value.corners, where, cards),
    measurements: parseMeasurements(value.measurements, where, ids),
    rotated: value.rotated === true,
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
  };
}

function parsePercent(value: unknown, name: string): number {
  if (!isNumber(value) || value < 0 || value > 100) {
    throw new RangeError(t('project.errors.percentRange', { name }));
  }
  return value;
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
  const color = parseChart(raw.color, t('project.errors.chartColor'), COLOR_CARDS, COLOR_IDS);
  // parseChart has already checked that raw.color is an object.
  const reference = (raw.color as Record<string, unknown>).reference;
  if (reference !== null && typeof reference !== 'string') {
    throw new TypeError(t('project.errors.colorReference'));
  }
  if (!isRecord(raw.preview)) {
    throw new TypeError(t('project.errors.previewMissing'));
  }
  const stills = parseStills(raw.stills);
  return {
    format: PROJECT_FORMAT,
    savedAt: typeof raw.savedAt === 'string' ? raw.savedAt : '',
    gray: parseChart(raw.gray, t('project.errors.chartGray'), GRAY_CARDS, GRAY_IDS),
    color: { ...color, reference },
    model: parseModel(raw.model),
    tone: raw.tone !== false,
    preview: {
      split: parsePercent(raw.preview.split, t('project.errors.splitName')),
    },
    ...(stills !== undefined && { stills }),
  };
}

export function serializeProject(project: Project): string {
  return `${JSON.stringify(project, null, 2)}\n`;
}
