import type { Corners } from '../chart/types';

// An upright card, 400 × 600 pixels, with its left edge at x: its corners clockwise from top left.
export function cardCorners(x: number): Corners {
  return [
    { x, y: 50 },
    { x: x + 400, y: 50 },
    { x: x + 400, y: 650 },
    { x, y: 650 },
  ];
}

// Both cards side by side in a 1280 × 720 image, as the detection finds them.
export function bothCards(): Corners[] {
  return [cardCorners(100), cardCorners(700)];
}
