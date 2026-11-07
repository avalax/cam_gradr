import type { Frame } from '../camera/frame';
import { CHANNELS } from '../color/srgb';

import { project } from './homography';
import type { Homography } from './homography';
import type { Rect, Rgb } from './types';

// The inner part of a patch that is sampled (edges and reflections stay out), and the number of
// sample points per row and column in it.
const INNER = 0.5;
const STEPS = 8;

// Median of a non-empty list (the caller guarantees this).
export function median(values: readonly number[]): number {
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const upper = Number(sorted[middle]);
  return sorted.length % 2 === 1 ? upper : (Number(sorted[middle - 1]) + upper) / 2;
}

function isInside(frame: Frame, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < frame.width && y < frame.height;
}

// Measures a patch: median per channel over a grid in the inner area of the patch (edges and
// reflections are excluded). Result in 0..1; null if the patch lies outside the image.
export function samplePatch(frame: Frame, homography: Homography, rect: Rect): Rgb | null {
  const margin = (1 - INNER) / 2;
  const channels: [number[], number[], number[]] = [[], [], []];
  for (let index = 0; index < STEPS * STEPS; index++) {
    const column = index % STEPS;
    const row = Math.floor(index / STEPS);
    const point = project(
      homography,
      rect.x + rect.w * (margin + (INNER * (column + 0.5)) / STEPS),
      rect.y + rect.h * (margin + (INNER * (row + 0.5)) / STEPS),
    );
    const px = Math.round(point.x);
    const py = Math.round(point.y);
    if (isInside(frame, px, py)) {
      const offset = (py * frame.width + px) * CHANNELS;
      for (const [channel, list] of channels.entries()) {
        list.push(Number(frame.data[offset + channel]));
      }
    }
  }
  const [r, g, b] = channels;
  return r.length === 0 ? null : [median(r), median(g), median(b)];
}
