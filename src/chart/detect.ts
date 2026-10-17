import type { Frame } from '../camera/frame';

import { sortCorners } from './corner-order';
import type { Corners, Point } from './types';

// Einfache Kartensuche ohne Bibliothek: Kanten im verkleinerten Graubild, grob in Zellen
// zusammengefasst, zusammenhängende Flächen mit den meisten Kanten gelten als Karten. Die vier
// Ecken einer Fläche sind ihre äußersten Kantenpunkte entlang der Diagonalen.
const MAX_WIDTH = 320;
const CELL = 8;
const MIN_CELL_EDGES = 3;
const MIN_EDGE_STEP = 0.04;
const MIN_AREA_SHARE = 0.02;
const LUMA = [0.2126, 0.7152, 0.0722] as const;

interface Gray {
  width: number;
  height: number;
  scale: number;
  data: Float32Array;
}

interface Extremes {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
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

// Markiert Pixel, an denen sich die Helligkeit deutlich ändert (Feld- und Kartenränder).
function edgeMap(gray: Gray): Uint8Array {
  const { width, height, data } = gray;
  const steps = new Float32Array(width * height);
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const here = Number(data[y * width + x]);
      steps[y * width + x] =
        Math.abs(Number(data[y * width + x + 1]) - here) +
        Math.abs(Number(data[(y + 1) * width + x]) - here);
    }
  }
  const mean = steps.reduce((sum, step) => sum + step, 0) / steps.length;
  const spread = Math.sqrt(steps.reduce((sum, step) => sum + (step - mean) ** 2, 0) / steps.length);
  const threshold = Math.max(MIN_EDGE_STEP, mean + spread);
  return Uint8Array.from(steps, (step) => (step > threshold ? 1 : 0));
}

// Zellen mit genug Kanten, eine Zelle breit nach außen erweitert, damit Lücken zwischen den Feldern
// die Fläche nicht zerreißen.
function activeCells(edges: Uint8Array, gray: Gray, columns: number, rows: number): Uint8Array {
  const counts = new Int32Array(columns * rows);
  for (const [index, edge] of edges.entries()) {
    if (edge === 1) {
      const cell =
        Math.floor(index / gray.width / CELL) * columns + Math.floor((index % gray.width) / CELL);
      counts[cell] = Number(counts[cell]) + 1;
    }
  }
  const active = (cx: number, cy: number) =>
    cx >= 0 &&
    cx < columns &&
    cy >= 0 &&
    cy < rows &&
    Number(counts[cy * columns + cx]) >= MIN_CELL_EDGES;
  return Uint8Array.from(counts, (_, cell) => {
    const cx = cell % columns;
    const cy = Math.floor(cell / columns);
    return [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => active(cx + dx, cy + dy))) ? 1 : 0;
  });
}

// Verbindet benachbarte Zellen zu Flächen (Nummer je Zelle, 0 = keine Fläche).
function labelCells(grown: Uint8Array, columns: number): Int32Array {
  const labels = new Int32Array(grown.length);
  let next = 0;
  for (const [start, cell] of grown.entries()) {
    if (cell === 1 && labels[start] === 0) {
      next++;
      labels[start] = next;
      const pending = [start];
      for (let current = pending.pop(); current !== undefined; current = pending.pop()) {
        const column = current % columns;
        const neighbours = [
          column > 0 ? current - 1 : -1,
          column < columns - 1 ? current + 1 : -1,
          current - columns,
          current + columns,
        ];
        for (const neighbour of neighbours) {
          if (grown[neighbour] === 1 && labels[neighbour] === 0) {
            labels[neighbour] = next;
            pending.push(neighbour);
          }
        }
      }
    }
  }
  return labels;
}

// Äußerste Kantenpunkte je Fläche: kleinste/größte Summe x+y und Differenz x−y.
function findExtremes(
  edges: Uint8Array,
  labels: Int32Array,
  width: number,
  columns: number,
): Extremes[] {
  const result: Record<number, Extremes | undefined> = {};
  for (const [index, edge] of edges.entries()) {
    const x = index % width;
    const y = Math.floor(index / width);
    const label = Number(labels[Math.floor(y / CELL) * columns + Math.floor(x / CELL)]);
    if (edge === 1 && label > 0) {
      const point = { x, y };
      const known = result[label];
      if (known === undefined) {
        result[label] = {
          topLeft: point,
          topRight: point,
          bottomRight: point,
          bottomLeft: point,
        };
      } else {
        known.topLeft = x + y < known.topLeft.x + known.topLeft.y ? point : known.topLeft;
        known.bottomRight =
          x + y > known.bottomRight.x + known.bottomRight.y ? point : known.bottomRight;
        known.topRight = x - y > known.topRight.x - known.topRight.y ? point : known.topRight;
        known.bottomLeft =
          x - y < known.bottomLeft.x - known.bottomLeft.y ? point : known.bottomLeft;
      }
    }
  }
  return Object.values(result).filter((known) => known !== undefined);
}

type Quad = readonly [Point, Point, Point, Point];

function quadOf(extremes: Extremes): Quad {
  return [extremes.topLeft, extremes.topRight, extremes.bottomRight, extremes.bottomLeft];
}

// Flächeninhalt eines Vierecks (Gaußsche Trapezformel).
function area([a, b, c, d]: Quad): number {
  const twice =
    a.x * b.y -
    b.x * a.y +
    (b.x * c.y - c.x * b.y) +
    (c.x * d.y - d.x * c.y) +
    (d.x * a.y - a.x * d.y);
  return Math.abs(twice) / 2;
}

function centreX(quad: readonly Point[]): number {
  return quad.reduce((sum, p) => sum + p.x, 0) / quad.length;
}

// Sucht `count` Karten im Bild und gibt ihre Ecken von links nach rechts zurück. Findet sich nicht
// genau diese Zahl plausibler Karten, kommt null zurück und die Ecken müssen von Hand gesetzt werden.
export function detectCards(frame: Frame, count: number): Corners[] | null {
  const gray = toGray(frame);
  const columns = Math.ceil(gray.width / CELL);
  const rows = Math.ceil(gray.height / CELL);
  const edges = edgeMap(gray);
  const labels = labelCells(activeCells(edges, gray, columns, rows), columns);

  const found = findExtremes(edges, labels, gray.width, columns)
    .map((extremes) => quadOf(extremes))
    .filter((quad) => area(quad) >= MIN_AREA_SHARE * gray.width * gray.height)
    .toSorted((a, b) => area(b) - area(a))
    .slice(0, count);
  if (found.length !== count) {
    return null;
  }
  return found
    .toSorted((a, b) => centreX(a) - centreX(b))
    .map((quad) => {
      const [a, b, c, d] = quad.map((p) => ({
        x: (p.x + 0.5) * gray.scale,
        y: (p.y + 0.5) * gray.scale,
      }));
      return sortCorners([a as Point, b as Point, c as Point, d as Point]);
    });
}
