import type { Corners } from '../chart/types';

// Height of the cards in the live image (fraction of the image height) below which the app warns:
// the search still finds smaller cards, but the measurement gets unreliable.
export const SMALL_SHARE = 0.18;
// Card height at which the size bar is full.
export const SIZE_SCALE = 0.4;

// Mean height of the found cards as a fraction of the image height.
export function cardSizeShare(found: readonly Corners[], imageHeight: number): number {
  const heights = found.map((corners) =>
    Math.hypot(corners[3].x - corners[0].x, corners[3].y - corners[0].y),
  );
  const mean = heights.reduce((sum, height) => sum + height, 0) / Math.max(heights.length, 1);
  return mean / imageHeight;
}

// Fill of the size bar (0..1) and position of the mark for the smallest comfortable size.
export function sizeBar(share: number): { fill: number; mark: number } {
  return { fill: Math.min(share / SIZE_SCALE, 1), mark: SMALL_SHARE / SIZE_SCALE };
}
