import type { Measurements } from './measure';
import type { Rgb } from './types';

// Which kind of cards a step expects: gray cards have neutral fields, color cards mostly colored ones.
export type CardKind = 'neutral' | 'colorful';

// Fields darker than this say nothing about their color (noise).
const MIN_BRIGHTNESS = 0.1;
// Saturation from which a field counts as colored.
const COLORED = 0.2;
// Gray cards: mean saturation of all fields at most this high (a mild color cast is allowed).
const NEUTRAL_MEAN = 0.12;
// Color cards: at least this share of the fields is colored (the gray ladder is neutral).
const COLORFUL_SHARE = 0.25;

function saturation([r, g, b]: Rgb): number {
  const max = Math.max(r, g, b);
  return max < MIN_BRIGHTNESS ? 0 : (max - Math.min(r, g, b)) / max;
}

// Do the measured fields fit the expected cards? Without measurements nothing speaks against it.
export function looksLike(kind: CardKind, measurements: Measurements): boolean {
  const values = Object.values(measurements).map((rgb) => saturation(rgb));
  if (values.length === 0) {
    return true;
  }
  return kind === 'neutral'
    ? values.reduce((sum, value) => sum + value, 0) / values.length <= NEUTRAL_MEAN
    : values.filter((value) => value >= COLORED).length / values.length >= COLORFUL_SHARE;
}
