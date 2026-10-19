import { COLOR_IDS, grayLayout } from '../chart/layouts';
import type { Point, Rgb } from '../chart/types';
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

// Zustand einer Kartengruppe: gesetzte Eckpunkte je Karte und gemessene Kamerawerte je Feld.
interface ChartState {
  corners: Record<number, Point[]>;
  measurements: Record<string, Rgb>;
  // Karten um 180° gedreht gehalten (fehlt in älteren Projektdateien).
  rotated: boolean;
}

export interface Project {
  format: typeof PROJECT_FORMAT;
  savedAt: string;
  gray: ChartState;
  color: ChartState & { reference: string | null };
  // Das berechnete Korrekturmodell; Referenzwerte (Herstellerdaten) werden bewusst nicht gespeichert.
  model: ColorModel | null;
  preview: { split: number };
  // Standbilder je Tab; fehlt in Dateien, die ohne Bilder gespeichert wurden.
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
    throw new TypeError(`${where}: erwartet werden 3 Zahlen`);
  }
  return value;
}

function parsePoint(value: unknown, where: string): Point {
  if (!isRecord(value) || !isNumber(value.x) || !isNumber(value.y)) {
    throw new TypeError(`${where}: ein Eckpunkt braucht x und y`);
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
      throw new RangeError(`${where}: unbekannte Karte ${key}`);
    }
    if (!Array.isArray(list) || list.length > 4) {
      throw new RangeError(`${where}: Karte ${key} hat eine ungültige Eckpunktliste`);
    }
    corners[Number(key)] = list.map((point) => parsePoint(point, `${where}, Karte ${key}`));
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
      throw new RangeError(`${where}: unbekanntes Feld ${id}`);
    }
    const [r = 0, g = 0, b = 0] = triple(rgb, `${where}, Feld ${id}`);
    if ([r, g, b].some((channel) => channel < 0 || channel > 1)) {
      throw new RangeError(`${where}, Feld ${id}: Werte müssen zwischen 0 und 1 liegen`);
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
    throw new TypeError(`${where}: erwartet werden corners und measurements`);
  }
  return {
    corners: parseCorners(value.corners, where, cards),
    measurements: parseMeasurements(value.measurements, where, ids),
    rotated: value.rotated === true,
  };
}

function parseCurve(value: unknown, index: number): { xs: number[]; ys: number[] } {
  const where = `Modell, Kurve ${String(index + 1)}`;
  if (!isRecord(value) || !Array.isArray(value.xs) || !Array.isArray(value.ys)) {
    throw new TypeError(`${where}: erwartet werden xs und ys`);
  }
  const { xs, ys } = value;
  if (
    xs.length < 2 ||
    xs.length !== ys.length ||
    !xs.every(isNumber) ||
    !ys.every(isNumber) ||
    xs.some((x, position) => position > 0 && x <= Number(xs[position - 1]))
  ) {
    throw new RangeError(`${where}: ungültige Stützpunkte`);
  }
  return { xs, ys };
}

function parseModel(value: unknown): ColorModel | null {
  if (value === null) {
    return null;
  }
  if (!isRecord(value) || !Array.isArray(value.curves) || value.curves.length !== 3) {
    throw new TypeError('Modell: erwartet werden drei Kurven und eine Matrix');
  }
  const [c1, c2, c3] = value.curves.map((curve, index) => parseCurve(curve, index));
  if (!Array.isArray(value.matrix) || value.matrix.length !== 3) {
    throw new TypeError('Modell: die Matrix braucht drei Zeilen');
  }
  const [r1, r2, r3] = value.matrix.map((row) => triple(row, 'Modell, Matrix'));
  return {
    curves: [c1, c2, c3] as unknown as ColorModel['curves'],
    matrix: [r1, r2, r3] as unknown as ColorModel['matrix'],
  };
}

function parsePercent(value: unknown, name: string): number {
  if (!isNumber(value) || value < 0 || value > 100) {
    throw new RangeError(`Vorschau: ${name} muss zwischen 0 und 100 liegen`);
  }
  return value;
}

function parseStill(value: unknown, key: string): EncodedFrame {
  const where = `Standbild "${key}"`;
  if (!isRecord(value) || value.encoding !== FRAME_ENCODING || typeof value.data !== 'string') {
    throw new TypeError(`${where}: unbekannte Codierung`);
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
    throw new RangeError(`${where}: ungültige Größe`);
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
    throw new TypeError('Standbilder: erwartet wird ein Objekt');
  }
  const stills: Partial<Record<StillKey, EncodedFrame>> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!STILL_KEYS.has(key)) {
      throw new RangeError(`Standbilder: unbekannter Tab "${key}"`);
    }
    stills[key as StillKey] = parseStill(entry, key);
  }
  return stills;
}

// Prüft eine Projektdatei und liefert typisierte Daten; Fehler haben verständliche Meldungen.
export function parseProject(text: string): Project {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new SyntaxError('Die Datei ist kein gültiges JSON', { cause: error });
  }
  if (!isRecord(raw) || raw.format !== PROJECT_FORMAT) {
    throw new TypeError(`Unbekanntes Format, erwartet wird "${PROJECT_FORMAT}"`);
  }
  const color = parseChart(raw.color, 'Farbkarten', COLOR_CARDS, COLOR_IDS);
  // parseChart hat bereits geprüft, dass raw.color ein Objekt ist.
  const reference = (raw.color as Record<string, unknown>).reference;
  if (reference !== null && typeof reference !== 'string') {
    throw new TypeError('Farbkarten: reference muss ein Name oder null sein');
  }
  if (!isRecord(raw.preview)) {
    throw new TypeError('Vorschau: Einstellungen fehlen');
  }
  const stills = parseStills(raw.stills);
  return {
    format: PROJECT_FORMAT,
    savedAt: typeof raw.savedAt === 'string' ? raw.savedAt : '',
    gray: parseChart(raw.gray, 'Graukarten', GRAY_CARDS, GRAY_IDS),
    color: { ...color, reference },
    model: parseModel(raw.model),
    preview: {
      split: parsePercent(raw.preview.split, 'Trennlinie'),
    },
    ...(stills !== undefined && { stills }),
  };
}

export function serializeProject(project: Project): string {
  return `${JSON.stringify(project, null, 2)}\n`;
}
