import type { Frame } from '../camera/frame';

import { sortCorners } from './corner-order';
import type { Corners, Point } from './types';

// Einfache Kartensuche ohne Bibliothek: Die Karten haben einen dunklen Rahmen um die Felder. Im
// verkleinerten Graubild werden dunkle Flächen gesucht, die nicht am Bildrand liegen und ungefähr
// das Seitenverhältnis einer hochkanten Karte haben. Ihre Ecken sind die äußersten Punkte der
// Fläche entlang der Diagonalen. Welche Helligkeit "dunkel" ist, hängt vom Licht ab; deshalb werden
// mehrere Schwellen probiert, bis genau die erwartete Zahl an Karten gefunden ist.
const MAX_WIDTH = 320;
const THRESHOLDS = [0.25, 0.2, 0.3, 0.15, 0.35] as const;
const MIN_AREA_SHARE = 0.04;
const MIN_ASPECT = 0.45;
const MAX_ASPECT = 0.85;
const LUMA = [0.2126, 0.7152, 0.0722] as const;

interface Gray {
  width: number;
  height: number;
  scale: number;
  data: Float32Array;
}

interface Extremes {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}

type Quad = readonly [Point, Point, Point, Point];

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

function include(known: Extremes, x: number, y: number): void {
  const point = { x, y };
  known.minX = Math.min(known.minX, x);
  known.maxX = Math.max(known.maxX, x);
  known.minY = Math.min(known.minY, y);
  known.maxY = Math.max(known.maxY, y);
  known.topLeft = x + y < known.topLeft.x + known.topLeft.y ? point : known.topLeft;
  known.bottomRight = x + y > known.bottomRight.x + known.bottomRight.y ? point : known.bottomRight;
  known.topRight = x - y > known.topRight.x - known.topRight.y ? point : known.topRight;
  known.bottomLeft = x - y < known.bottomLeft.x - known.bottomLeft.y ? point : known.bottomLeft;
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

// Sammelt die zusammenhängende dunkle Fläche ab einem Startpixel und merkt sich Ausdehnung und die
// äußersten Punkte entlang der Diagonalen.
function floodArea(gray: Gray, threshold: number, start: number, seen: Uint8Array): Extremes {
  const { width, height, data } = gray;
  const first = { x: start % width, y: Math.floor(start / width) };
  const known: Extremes = {
    minX: first.x,
    maxX: first.x,
    minY: first.y,
    maxY: first.y,
    topLeft: first,
    topRight: first,
    bottomRight: first,
    bottomLeft: first,
  };
  seen[start] = 1;
  const pending = [start];
  for (let cell = pending.pop(); cell !== undefined; cell = pending.pop()) {
    include(known, cell % width, Math.floor(cell / width));
    for (const next of neighboursOf(cell, width, height)) {
      if (seen[next] === 0 && Number(data[next]) < threshold) {
        seen[next] = 1;
        pending.push(next);
      }
    }
  }
  return known;
}

// Alle zusammenhängenden dunklen Flächen des Bildes.
function darkAreas(gray: Gray, threshold: number): Extremes[] {
  const seen = new Uint8Array(gray.data.length);
  const areas: Extremes[] = [];
  for (const [start, value] of gray.data.entries()) {
    if (value < threshold && seen[start] === 0) {
      areas.push(floodArea(gray, threshold, start, seen));
    }
  }
  return areas;
}

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

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function centreX(quad: Quad): number {
  return (quad[0].x + quad[1].x + quad[2].x + quad[3].x) / 4;
}

// Eine Karte liegt ganz im Bild, ist groß genug und hochkant (Breite zu Höhe etwa 2 : 3).
function looksLikeCard(extremes: Extremes, gray: Gray): boolean {
  const quad = quadOf(extremes);
  const [a, b, c, d] = quad;
  const width = (distance(a, b) + distance(d, c)) / 2;
  const height = (distance(a, d) + distance(b, c)) / 2;
  return (
    extremes.minX > 0 &&
    extremes.minY > 0 &&
    extremes.maxX < gray.width - 1 &&
    extremes.maxY < gray.height - 1 &&
    area(quad) >= MIN_AREA_SHARE * gray.width * gray.height &&
    width / height >= MIN_ASPECT &&
    width / height <= MAX_ASPECT
  );
}

// Sucht `count` Karten im Bild und gibt ihre Ecken von links nach rechts zurück. Findet sich nicht
// genau diese Zahl plausibler Karten, kommt null zurück und die Ecken müssen von Hand gesetzt werden.
export function detectCards(frame: Frame, count: number): Corners[] | null {
  const gray = toGray(frame);
  for (const threshold of THRESHOLDS) {
    const cards = darkAreas(gray, threshold).filter((extremes) => looksLikeCard(extremes, gray));
    if (cards.length === count) {
      return cards
        .map((extremes) => quadOf(extremes))
        .toSorted((a, b) => centreX(a) - centreX(b))
        .map((quad) => {
          const [a, b, c, d] = quad.map((point) => ({
            x: (point.x + 0.5) * gray.scale,
            y: (point.y + 0.5) * gray.scale,
          }));
          return sortCorners([a as Point, b as Point, c as Point, d as Point]);
        });
    }
  }
  return null;
}
