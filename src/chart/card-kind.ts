import type { Measurements } from './measure';
import type { Rgb } from './types';

// Which kind of cards a step expects.
export type CardKind = 'neutral' | 'colorful';

// Fields darker than this say nothing about their color (noise, and the black level of a camera
// is often tinted).
const MIN_BRIGHTNESS = 0.25;
// Saturation from which a field counts as colored.
const COLORED = 0.2;
// Share of colored fields from which the cards count as color cards (the gray ladder is neutral,
// the rest of a color card is colorful; gray cards have no colored field at all).
const COLOR_CARDS_SHARE = 0.25;
// Lowest share of a channel taken as the cast, so that the division stays defined.
const MIN_CAST = 0.01;

function median(values: readonly number[]): number {
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}

function saturation([r, g, b]: Rgb): number {
  const max = Math.max(r, g, b);
  return max < MIN_BRIGHTNESS ? 0 : (max - Math.min(r, g, b)) / max;
}

// The typical color of a field (share of each channel in the sum), the same for all fields of
// gray cards and varied on color cards. Only a color cast moves the median away from 1/3.
function cast(fields: readonly Rgb[]): Rgb {
  const shares = fields
    .filter(([r, g, b]) => r + g + b > 0)
    .map(([r, g, b]): Rgb => [r / (r + g + b), g / (r + g + b), b / (r + g + b)]);
  return [0, 1, 2].map((channel) =>
    shares.length === 0 ? 1 / 3 : median(shares.map((share) => share[channel] ?? 0)),
  ) as unknown as Rgb;
}

// Share of the colored fields among the fields measured with the layout of the color cards. A
// color cast of the camera (a bluish room, a warm lamp) is removed first, otherwise gray cards
// would look colorful.
export function coloredShare(measurements: Measurements): number {
  const fields = Object.values(measurements);
  const [cr, cg, cb] = cast(fields).map((share) => Math.max(share, MIN_CAST));
  const values = fields.map(([r, g, b]) =>
    saturation([r / (3 * Number(cr)), g / (3 * Number(cg)), b / (3 * Number(cb))]),
  );
  return values.length === 0
    ? 0
    : values.filter((value) => value >= COLORED).length / values.length;
}

// Are the cards of the kind the step expects, judged by the colored share?
export function isExpectedKind(kind: CardKind, share: number): boolean {
  return share >= COLOR_CARDS_SHARE === (kind === 'colorful');
}
