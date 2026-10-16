import type { Corners, Point } from './types';

// Projektive Abbildung vom Einheitsquadrat auf ein Viereck: [a, b, c, d, e, f, g, h].
export type Homography = readonly [number, number, number, number, number, number, number, number];

const EPSILON = 1e-12;

// Bildet (0,0) -> oben links, (1,0) -> oben rechts, (1,1) -> unten rechts, (0,1) -> unten links ab.
export function homographyFromCorners(corners: Corners): Homography {
  const [p0, p1, p2, p3] = corners;
  const sx = p0.x - p1.x + p2.x - p3.x;
  const sy = p0.y - p1.y + p2.y - p3.y;
  if (Math.abs(sx) < EPSILON && Math.abs(sy) < EPSILON) {
    return [p1.x - p0.x, p2.x - p1.x, p0.x, p1.y - p0.y, p2.y - p1.y, p0.y, 0, 0];
  }
  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const denominator = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(denominator) < EPSILON) {
    throw new RangeError('Die Eckpunkte liegen auf einer Linie.');
  }
  const g = (sx * dy2 - dx2 * sy) / denominator;
  const h = (dx1 * sy - sx * dy1) / denominator;
  return [
    p1.x - p0.x + g * p1.x,
    p3.x - p0.x + h * p3.x,
    p0.x,
    p1.y - p0.y + g * p1.y,
    p3.y - p0.y + h * p3.y,
    p0.y,
    g,
    h,
  ];
}

// Wendet die Abbildung auf einen Punkt (u, v) im Einheitsquadrat an.
export function project(homography: Homography, u: number, v: number): Point {
  const [a, b, c, d, e, f, g, h] = homography;
  const w = g * u + h * v + 1;
  return { x: (a * u + b * v + c) / w, y: (d * u + e * v + f) / w };
}
