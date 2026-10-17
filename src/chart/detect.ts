import type { Frame } from '../camera/frame';

import { sortCorners } from './corner-order';
import type { Corners, Point } from './types';

// Einfache Kartensuche ohne Bibliothek: Die Karten haben einen dunklen Rahmen um die Felder. Im
// verkleinerten Graubild werden dunkle Flächen gesucht, die nicht am Bildrand liegen und ungefähr
// das Seitenverhältnis einer hochkanten Karte haben. Die Ecken ergeben sich als Schnittpunkte von
// vier Geraden, die an die geraden Seiten der Fläche angepasst werden (Aussparungen und runde Ecken
// stören so kaum, und Schräglage und Perspektive bleiben erhalten). Ist eine Seite nicht gerade
// (verwackeltes Bild) oder passen die beiden Karten nicht zueinander, gilt nichts als erkannt.
// Welche Helligkeit "dunkel" ist, hängt vom Licht ab; deshalb werden mehrere Schwellen probiert,
// bis genau die erwartete Zahl an Karten gefunden ist.
const MAX_WIDTH = 320;
const THRESHOLDS = [0.25, 0.2, 0.3, 0.15, 0.35] as const;
// Mindestgröße der dunklen Fläche (Anteil am Bild); die hellen Felder innen zählen nicht mit.
const MIN_DARK_SHARE = 0.01;
const MIN_ASPECT = 0.45;
const MAX_ASPECT = 0.85;
// Von jeder Seite gehen nur die beiden Endstücke (zwischen 10 % und 30 % der Länge vom Ende) in die
// Gerade ein: In der Mitte von Ober- und Unterkante liegen die Laschen der Karte, ganz am Ende die
// runden Ecken.
const END_FROM = 0.1;
const END_TO = 0.3;
// Größte mittlere Abweichung der Randpunkte von ihrer Geraden, als Anteil der Kartengröße.
const MAX_EDGE_ERROR = 0.02;
// Anteil der Randpunkte, der in die Gerade eingeht, und Zahl der Wiederholungen.
const KEEP_SHARE = 0.8;
const TRIM_ROUNDS = 4;
// Zwei Karten im selben Etui sind etwa gleich groß.
const MAX_SIZE_RATIO = 1.25;
const LUMA = [0.2126, 0.7152, 0.0722] as const;

interface Gray {
  width: number;
  height: number;
  scale: number;
  data: Float32Array;
}

// Gerade u = offset + slope * v (u: x bei den Seiten, y bei Ober- und Unterkante).
interface Line {
  offset: number;
  slope: number;
  error: number;
}

interface Card {
  corners: readonly [Point, Point, Point, Point];
  width: number;
  height: number;
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

// Nachbarn eines Pixels (4er-Nachbarschaft) innerhalb des Bildes.
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

// Sammelt die zusammenhängende dunkle Fläche ab einem Startpixel (Pixelnummern).
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

// Eine Fläche, die den Bildrand berührt, ist angeschnitten und keine ganze Karte.
function touchesBorder(cells: readonly number[], gray: Gray): boolean {
  return cells.some((cell) => {
    const x = cell % gray.width;
    const y = Math.floor(cell / gray.width);
    return x === 0 || y === 0 || x === gray.width - 1 || y === gray.height - 1;
  });
}

// Alle zusammenhängenden dunklen Flächen des Bildes, die groß genug sind und ganz im Bild liegen.
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

// Ausgleichsgerade u = offset + slope · v durch die Punkte.
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

// Gerade durch die Randpunkte. Aussparungen der Karte (Laschen oben und unten) liegen auf einer Seite
// der Geraden und würden sie verziehen; deshalb werden mehrmals nur die am besten passenden Punkte
// verwendet (getrimmte Ausgleichsrechnung).
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

// Nummern (Zeilen oder Spalten) der beiden Endstücke einer Seite, soweit die Fläche dort vorkommt.
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

// Randpunkte der Fläche: je Zeile links und rechts, je Spalte oben und unten.
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

// Schnittpunkt einer Seite x = a + b·y mit Ober- oder Unterkante y = c + d·x.
function cross(side: Line, edge: Line): Point {
  const x = (side.offset + side.slope * edge.offset) / (1 - side.slope * edge.slope);
  return { x, y: edge.offset + edge.slope * x };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Bestimmt Ecken und Maße einer Fläche; null, wenn sie keine hochkante Karte mit geraden Seiten ist.
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
  const straight =
    Math.max(lines.left.error, lines.right.error, lines.top.error, lines.bottom.error) <=
    MAX_EDGE_ERROR * Math.min(width, height);
  const upright = width / height >= MIN_ASPECT && width / height <= MAX_ASPECT;
  return inside && straight && upright ? { corners: [a, b, c, d], width, height } : null;
}

function similar(a: number, b: number): boolean {
  return Math.max(a, b) / Math.min(a, b) <= MAX_SIZE_RATIO;
}

// Zwei Karten müssen etwa gleich groß sein; bei anderer Zahl gibt es nichts zu vergleichen.
function fitTogether(cards: readonly Card[]): boolean {
  const [first, second] = cards;
  return (
    first === undefined ||
    second === undefined ||
    (similar(first.width, second.width) && similar(first.height, second.height))
  );
}

// Sucht `count` Karten im Bild und gibt ihre Ecken von links nach rechts zurück. Findet sich nicht
// genau diese Zahl plausibler, zueinander passender Karten, kommt null zurück und die Ecken müssen
// von Hand gesetzt werden.
export function detectCards(frame: Frame, count: number): Corners[] | null {
  const gray = toGray(frame);
  for (const threshold of THRESHOLDS) {
    const cards = darkAreas(gray, threshold)
      .map((cells) => cardFrom(cells, gray))
      .filter((card) => card !== null);
    if (cards.length === count && fitTogether(cards)) {
      return cards
        .toSorted((p, q) => p.corners[0].x - q.corners[0].x)
        .map((card) => {
          const [a, b, c, d] = card.corners;
          const [p, q, r, s] = [a, b, c, d].map((point) => ({
            x: (point.x + 0.5) * gray.scale,
            y: (point.y + 0.5) * gray.scale,
          }));
          return sortCorners([p as Point, q as Point, r as Point, s as Point]);
        });
    }
  }
  return null;
}

// Prüft, ob zwei Erkennungen (z. B. aus aufeinanderfolgenden Bildern) dieselben Karten an derselben
// Stelle zeigen: jede Ecke darf höchstens `tolerance` Pixel abweichen.
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
