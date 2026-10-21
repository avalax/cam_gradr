import type { Frame } from '../camera/frame';

import { sortCorners } from './corner-order';
import type { Corners, Point } from './types';

// Simple chart detection without a library: the charts have a dark frame around the patches. In
// the downscaled gray image, dark areas are searched that do not touch the image edge and have
// roughly the aspect ratio of an upright chart. The corners result as intersections of four
// lines fitted to the straight sides of the area (cutouts and rounded corners hardly disturb
// this, and skew and perspective are preserved). If a side is not straight (blurred image) or
// the charts do not match each other, nothing counts as detected. Which brightness is "dark"
// depends on the light, so all thresholds are tried and the cleanest matching group of charts
// is taken.
const MAX_WIDTH = 320;
const THRESHOLDS = [0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45] as const;
// Minimum size of the dark area (fraction of the image); the bright patches inside do not
// count. Small enough for cards held at the distance of the subject (about 12 % of the image
// height); the aspect ratio and straight edges keep other dark areas out.
const MIN_DARK_SHARE = 0.003;
const MIN_ASPECT = 0.45;
const MAX_ASPECT = 0.85;
// Only the two end pieces of each side (between 10 % and 30 % of the length from the end) go
// into the line: the tabs of the chart sit in the middle of the top and bottom edges, and the
// rounded corners at the very end.
const END_FROM = 0.1;
const END_TO = 0.3;
// Largest mean deviation of the edge points from their line, as a fraction of the chart size.
const MAX_EDGE_ERROR = 0.02;
// Fraction of edge points that go into the line, and number of repetitions.
const KEEP_SHARE = 0.8;
const TRIM_ROUNDS = 4;
// Two charts in the same case are about the same size, side by side at about the same height.
const MAX_SIZE_RATIO = 1.25;
const MIN_GAP = 0.8;
const MAX_OFFSET = 0.35;
// Candidates whose centers are closer than this (fraction of the chart width) are the same chart.
const SAME_PLACE = 0.5;
// Edges straighter than this count as clean. Of the clean candidates for a chart the smallest
// one wins: a threshold that is too high lets the dark frame leak into shadows next to the chart
// and makes the area too large, while the frame itself stays straight.
const CLEAN_EDGE_ERROR = 0.01;
const UNCLEAN_RANK = 1e9;
const LUMA = [0.2126, 0.7152, 0.0722] as const;

interface Gray {
  width: number;
  height: number;
  scale: number;
  data: Float32Array;
}

// Line u = offset + slope * v (u: x for the sides, y for the top and bottom edges).
interface Line {
  offset: number;
  slope: number;
  error: number;
}

interface Card {
  corners: readonly [Point, Point, Point, Point];
  width: number;
  height: number;
  // Largest deviation of an edge from its line relative to the chart size (smaller = cleaner).
  error: number;
}

function toGray(frame: Frame): Gray {
  const scale = Math.max(1, Math.ceil(frame.width / MAX_WIDTH));
  const width = Math.floor(frame.width / scale);
  const height = Math.floor(frame.height / scale);
  const data = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let total = 0;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const offset = ((y * scale + dy) * frame.width + x * scale + dx) * LUMA.length;
          total +=
            LUMA[0] * Number(frame.data[offset]) +
            LUMA[1] * Number(frame.data[offset + 1]) +
            LUMA[2] * Number(frame.data[offset + 2]);
        }
      }
      data[y * width + x] = total / (scale * scale);
    }
  }
  return { width, height, scale, data };
}

// Neighbors of a pixel (4-neighborhood) within the image.
function neighboursOf(cell: number, width: number, height: number): number[] {
  const x = cell % width;
  const y = Math.floor(cell / width);
  return [
    x > 0 ? cell - 1 : -1,
    x < width - 1 ? cell + 1 : -1,
    y > 0 ? cell - width : -1,
    y < height - 1 ? cell + width : -1,
  ].filter((next) => next >= 0);
}

// Collects the connected dark area from a start pixel (pixel indices).
function floodArea(gray: Gray, threshold: number, start: number, seen: Uint8Array): number[] {
  const { width, height, data } = gray;
  const cells: number[] = [];
  seen[start] = 1;
  const pending = [start];
  for (let cell = pending.pop(); cell !== undefined; cell = pending.pop()) {
    cells.push(cell);
    for (const next of neighboursOf(cell, width, height)) {
      if (seen[next] === 0 && Number(data[next]) < threshold) {
        seen[next] = 1;
        pending.push(next);
      }
    }
  }
  return cells;
}

// An area that touches the image edge is cut off and not a whole chart.
function touchesBorder(cells: readonly number[], gray: Gray): boolean {
  return cells.some((cell) => {
    const x = cell % gray.width;
    const y = Math.floor(cell / gray.width);
    return x === 0 || y === 0 || x === gray.width - 1 || y === gray.height - 1;
  });
}

// All connected dark areas of the image that are large enough and lie entirely within it.
function darkAreas(gray: Gray, threshold: number): number[][] {
  const seen = new Uint8Array(gray.data.length);
  const minCells = MIN_DARK_SHARE * gray.data.length;
  const areas: number[][] = [];
  for (const [start, value] of gray.data.entries()) {
    if (value < threshold && seen[start] === 0) {
      const cells = floodArea(gray, threshold, start, seen);
      if (cells.length >= minCells && !touchesBorder(cells, gray)) {
        areas.push(cells);
      }
    }
  }
  return areas;
}

type Sample = readonly [number, number];

// Best-fit line u = offset + slope · v through the points.
function leastSquares(list: readonly Sample[]): Line {
  const n = list.length;
  const meanV = list.reduce((sum, [v]) => sum + v, 0) / n;
  const meanU = list.reduce((sum, [, u]) => sum + u, 0) / n;
  const spread = list.reduce((sum, [v]) => sum + (v - meanV) ** 2, 0);
  const slope =
    spread === 0 ? 0 : list.reduce((sum, [v, u]) => sum + (v - meanV) * (u - meanU), 0) / spread;
  const offset = meanU - slope * meanV;
  const error = Math.sqrt(list.reduce((sum, [v, u]) => sum + (u - offset - slope * v) ** 2, 0) / n);
  return { offset, slope, error };
}

// Line through the edge points. Cutouts of the chart (tabs at the top and bottom) lie on one side
// of the line and would distort it; therefore only the best-fitting points are used repeatedly
// (trimmed least squares).
function fitLine(points: readonly Sample[]): Line {
  const keep = Math.max(2, Math.ceil(points.length * KEEP_SHARE));
  let line = leastSquares(points);
  for (let round = 0; round < TRIM_ROUNDS; round++) {
    const current = line;
    const best = points
      .toSorted(
        (p, q) =>
          Math.abs(p[1] - current.offset - current.slope * p[0]) -
          Math.abs(q[1] - current.offset - current.slope * q[0]),
      )
      .slice(0, keep);
    line = leastSquares(best);
  }
  return line;
}

// Indices (rows or columns) of the two end pieces of a side, as far as the area exists there.
function endIndices(extent: readonly number[]): number[] {
  const present = extent.map((_, index) => index).filter((index) => Number.isFinite(extent[index]));
  const first = Number(present[0]);
  const last = Number(present.at(-1));
  const span = last - first;
  return present.filter(
    (index) =>
      (index >= first + END_FROM * span && index <= first + END_TO * span) ||
      (index >= last - END_TO * span && index <= last - END_FROM * span),
  );
}

// Edge points of the area: left and right per row, top and bottom per column.
function edgeLines(cells: readonly number[], gray: Gray) {
  const { width, height } = gray;
  const left = Array.from({ length: height }, () => Infinity);
  const right = Array.from({ length: height }, () => -Infinity);
  const top = Array.from({ length: width }, () => Infinity);
  const bottom = Array.from({ length: width }, () => -Infinity);
  for (const cell of cells) {
    const x = cell % width;
    const y = Math.floor(cell / width);
    left[y] = Math.min(Number(left[y]), x);
    right[y] = Math.max(Number(right[y]), x);
    top[x] = Math.min(Number(top[x]), y);
    bottom[x] = Math.max(Number(bottom[x]), y);
  }
  const rows = endIndices(left);
  const columns = endIndices(top);
  return {
    left: fitLine(rows.map((y) => [y, Number(left[y])] as const)),
    right: fitLine(rows.map((y) => [y, Number(right[y])] as const)),
    top: fitLine(columns.map((x) => [x, Number(top[x])] as const)),
    bottom: fitLine(columns.map((x) => [x, Number(bottom[x])] as const)),
  };
}

// Intersection of a side x = a + b·y with the top or bottom edge y = c + d·x.
function cross(side: Line, edge: Line): Point {
  const x = (side.offset + side.slope * edge.offset) / (1 - side.slope * edge.slope);
  return { x, y: edge.offset + edge.slope * x };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Determines the corners and dimensions of an area; null if it is not an upright chart with
// straight sides.
function cardFrom(cells: readonly number[], gray: Gray): Card | null {
  const lines = edgeLines(cells, gray);
  const a = cross(lines.left, lines.top);
  const b = cross(lines.right, lines.top);
  const c = cross(lines.right, lines.bottom);
  const d = cross(lines.left, lines.bottom);
  const width = (distance(a, b) + distance(d, c)) / 2;
  const height = (distance(a, d) + distance(b, c)) / 2;
  const inside = [a, b, c, d].every(
    (p) => p.x > 0 && p.y > 0 && p.x < gray.width - 1 && p.y < gray.height - 1,
  );
  const error =
    Math.max(lines.left.error, lines.right.error, lines.top.error, lines.bottom.error) /
    Math.min(width, height);
  const upright = width / height >= MIN_ASPECT && width / height <= MAX_ASPECT;
  const clean = error <= MAX_EDGE_ERROR;
  return inside && clean && upright ? { corners: [a, b, c, d], width, height, error } : null;
}

function similar(a: number, b: number): boolean {
  return Math.max(a, b) / Math.min(a, b) <= MAX_SIZE_RATIO;
}

function center(card: Card): Point {
  let x = 0;
  let y = 0;
  for (const corner of card.corners) {
    x += corner.x;
    y += corner.y;
  }
  return { x: x / card.corners.length, y: y / card.corners.length };
}

function area(card: Card): number {
  return card.width * card.height;
}

// Ranking of a candidate for a chart (smaller is better): clean ones by size, unclean ones after
// all clean ones by their edge error.
function rank(card: Card): number {
  return card.error <= CLEAN_EDGE_ERROR ? area(card) : UNCLEAN_RANK + card.error;
}

// Candidates from different thresholds that sit on the same chart: only the best one counts.
function bestPerPlace(candidates: readonly Card[]): Card[] {
  const result: Card[] = [];
  const ranked = candidates.toSorted((p, q) => rank(p) - rank(q));
  for (const card of ranked) {
    const middle = center(card);
    const taken = result.some(
      (other) => distance(center(other), middle) < SAME_PLACE * Math.min(card.width, other.width),
    );
    if (!taken) {
      result.push(card);
    }
  }
  return result;
}

// Charts in the same case are about the same size, stand side by side and at about the same
// height without overlapping.
function fitTogether(cards: readonly Card[]): boolean {
  const ordered = cards.toSorted((a, b) => center(a).x - center(b).x);
  return ordered.every((card, index) => {
    const next = ordered[index + 1];
    if (next === undefined) {
      return true;
    }
    const gap = center(next).x - center(card).x;
    const offset = Math.abs(center(next).y - center(card).y);
    return (
      similar(card.width, next.width) &&
      similar(card.height, next.height) &&
      gap >= MIN_GAP * Math.max(card.width, next.width) &&
      offset <= MAX_OFFSET * Math.max(card.height, next.height)
    );
  });
}

// All selections of `count` items from the list.
function selections<T>(items: readonly T[], count: number): T[][] {
  if (count === 0) {
    return [[]];
  }
  return items.flatMap((item, index) =>
    selections(items.slice(index + 1), count - 1).map((rest) => [item, ...rest]),
  );
}

// Searches for `count` charts in the image and returns their corners from left to right. All
// thresholds are tried; of the plausible charts the best matching group with the cleanest edges
// wins (other dark objects such as hair or clothes do not matter). If no such group exists, null
// is returned and the corners must be set by hand.
export function detectCards(frame: Frame, count: number): Corners[] | null {
  const gray = toGray(frame);
  const candidates = THRESHOLDS.flatMap((threshold) =>
    darkAreas(gray, threshold)
      .map((cells) => cardFrom(cells, gray))
      .filter((card) => card !== null),
  );
  const groups = selections(bestPerPlace(candidates), count)
    .filter((cards) => fitTogether(cards))
    .toSorted(
      (p, q) => p.reduce((sum, c) => sum + c.error, 0) - q.reduce((sum, c) => sum + c.error, 0),
    );
  const best = groups[0];
  if (best === undefined) {
    return null;
  }
  return best
    .toSorted((p, q) => center(p).x - center(q).x)
    .map((card) => {
      const [a, b, c, d] = card.corners;
      const [p, q, r, s] = [a, b, c, d].map((point) => ({
        x: (point.x + 0.5) * gray.scale,
        y: (point.y + 0.5) * gray.scale,
      }));
      return sortCorners([p as Point, q as Point, r as Point, s as Point]);
    });
}

// Checks whether two detections (e.g. from consecutive images) show the same charts at the same
// place: each corner may deviate by at most `tolerance` pixels.
export function sameCards(
  a: readonly Corners[],
  b: readonly Corners[],
  tolerance: number,
): boolean {
  return (
    a.length === b.length &&
    a.every((card, index) =>
      card.every((corner, side) => {
        const other = b[index]?.[side];
        return other !== undefined && distance(corner, other) <= tolerance;
      }),
    )
  );
}
