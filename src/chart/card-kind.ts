import type { Measurements } from './measure';
import type { Rgb } from './types';

// Which kind of cards a step expects.
export type CardKind = 'neutral' | 'colorful';

// Fields darker than this say nothing about their color (noise).
const MIN_BRIGHTNESS = 0.1;
// Saturation from which a field counts as colored.
const COLORED = 0.2;
// Share of colored fields from which the cards count as color cards (the gray ladder is neutral,
// the rest of a color card is colorful; gray cards have no colored field at all).
const COLOR_CARDS_SHARE = 0.25;

function saturation([r, g, b]: Rgb): number {
  const max = Math.max(r, g, b);
  return max < MIN_BRIGHTNESS ? 0 : (max - Math.min(r, g, b)) / max;
}

// Share of the colored fields among the fields measured with the layout of the color cards.
export function coloredShare(measurements: Measurements): number {
  const values = Object.values(measurements).map((rgb) => saturation(rgb));
  return values.length === 0
    ? 0
    : values.filter((value) => value >= COLORED).length / values.length;
}

// Are the cards of the kind the step expects, judged by the colored share?
export function isExpectedKind(kind: CardKind, share: number): boolean {
  return share >= COLOR_CARDS_SHARE === (kind === 'colorful');
}
