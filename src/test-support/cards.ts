import type { Corners } from '../chart/types';

// An upright card in a 1280 × 720 image: 400 × 600 pixels from y = 50, with its left edge at x. The
// two cards of a pair stand side by side, as the synthetic camera of the acceptance tests draws them.
const TOP = 50;
const WIDTH = 400;
const HEIGHT = 600;
export const CARD_LEFTS = [100, 700] as const;

// The rectangle of a card in pixels.
export function cardRect(x: number): { x: number; y: number; w: number; h: number } {
  return { x, y: TOP, w: WIDTH, h: HEIGHT };
}

// Its corners clockwise from top left.
export function cardCorners(x: number): Corners {
  return [
    { x, y: TOP },
    { x: x + WIDTH, y: TOP },
    { x: x + WIDTH, y: TOP + HEIGHT },
    { x, y: TOP + HEIGHT },
  ];
}

// Both cards side by side, as the detection finds them.
export function bothCards(): Corners[] {
  return CARD_LEFTS.map((x) => cardCorners(x));
}
