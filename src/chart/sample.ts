import { project } from './homography';
import type { Homography } from './homography';
import type { PixelGrid, Rect, Rgb } from './types';

const DEFAULT_INNER = 0.5;
const DEFAULT_STEPS = 8;

// Median of a non-empty list (the caller guarantees this).
function median(values: number[]): number {
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const upper = Number(sorted[middle]);
  return sorted.length % 2 === 1 ? upper : (Number(sorted[middle - 1]) + upper) / 2;
}

function isInside(grid: PixelGrid, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < grid.width && y < grid.height;
}

// Measures a patch: median per channel over a grid in the inner area of the patch (edges and
// reflections are excluded). Result in 0..1; null if the patch lies outside the image.
export function samplePatch(
  grid: PixelGrid,
  homography: Homography,
  rect: Rect,
  inner = DEFAULT_INNER,
  steps = DEFAULT_STEPS,
): Rgb | null {
  const margin = (1 - inner) / 2;
  const channels: [number[], number[], number[]] = [[], [], []];
  for (let index = 0; index < steps * steps; index++) {
    const column = index % steps;
    const row = Math.floor(index / steps);
    const point = project(
      homography,
      rect.x + rect.w * (margin + (inner * (column + 0.5)) / steps),
      rect.y + rect.h * (margin + (inner * (row + 0.5)) / steps),
    );
    const px = Math.round(point.x);
    const py = Math.round(point.y);
    if (isInside(grid, px, py)) {
      const offset = (py * grid.width + px) * grid.channels;
      for (const [channel, list] of channels.entries()) {
        list.push((grid.data[offset + channel] ?? 0) / grid.maxValue);
      }
    }
  }
  const [r, g, b] = channels;
  return r.length === 0 ? null : [median(r), median(g), median(b)];
}
