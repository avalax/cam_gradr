import type { Corners, Point } from './types';

// Puts four clicked corners into the order top left, top right, bottom right,
// bottom left (clockwise), regardless of the order in which they were set.
export function sortCorners(points: readonly [Point, Point, Point, Point]): Corners {
  const centre = {
    x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
    y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
  };
  // Image coordinates: y grows downward, so an increasing angle runs clockwise.
  const clockwise = points.toSorted(
    (a, b) =>
      Math.atan2(a.y - centre.y, a.x - centre.x) - Math.atan2(b.y - centre.y, b.x - centre.x),
  );
  // Start at the top left corner: smallest sum of x and y.
  const sums = clockwise.map((p) => p.x + p.y);
  const start = sums.indexOf(Math.min(...sums));
  return [...clockwise.slice(start), ...clockwise.slice(0, start)] as unknown as Corners;
}
