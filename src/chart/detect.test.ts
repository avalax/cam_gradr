import { describe, expect, it } from 'vitest';

import type { Frame } from '../camera/frame';

import { detectCards, sameCards } from './detect';
import type { Corners, Point } from './types';

const SIZE = { width: 640, height: 360 };
const TOLERANCE = 12;
const BACKGROUND = 0.6;

interface CardOptions {
  // Brightness of the dark frame.
  dark?: number;
  // Lateral offset of the bottom edge relative to the top edge (parallelogram).
  shear?: number;
  // Bright tabs in the middle of the top and bottom edges (as on the real charts).
  tabs?: boolean;
}

function paint(frame: Frame, x: number, y: number, value: number) {
  frame.data.set([value, value, value], (y * frame.width + x) * 3);
}

// Tab: middle of the top and bottom edges (column as a fraction of the width, row from the
// top edge).
function isTab(column: number, row: number, height: number): boolean {
  return column > 0.3 && column < 0.7 && (row < 14 || height - row <= 14);
}

// Brightness of a point on the chart: bright patches inside (with margin), otherwise the dark
// frame.
function cardValue(column: number, row: number, w: number, h: number, o: CardOptions): number {
  const border = Math.round(w / 8);
  const inside = column >= border && column < w - border && row >= border && row < h - border;
  return inside || (o.tabs === true && isTab(column / w, row, h)) ? 0.8 : (o.dark ?? 0.08);
}

// Chart with a dark frame and bright patches inside (like the real charts).
function drawCard(frame: Frame, x0: number, y0: number, w: number, h: number, o: CardOptions = {}) {
  for (let y = y0; y < y0 + h; y++) {
    const offset = Math.round(((y - y0) / h) * (o.shear ?? 0));
    for (let x = x0 + offset; x < x0 + offset + w; x++) {
      paint(frame, x, y, cardValue(x - x0 - offset, y - y0, w, h, o));
    }
  }
}

function scene(draw: (frame: Frame) => void): Frame {
  const data = new Float32Array(SIZE.width * SIZE.height * 3).fill(BACKGROUND);
  const frame = { ...SIZE, data };
  draw(frame);
  return frame;
}

function expectPoint(actual: Point | undefined, expected: Point): void {
  expect(Math.abs((actual?.x ?? NaN) - expected.x)).toBeLessThanOrEqual(TOLERANCE);
  expect(Math.abs((actual?.y ?? NaN) - expected.y)).toBeLessThanOrEqual(TOLERANCE);
}

function expectCard(card: Corners | undefined, x: number, y: number, w: number, h: number) {
  expectPoint(card?.[0], { x, y });
  expectPoint(card?.[1], { x: x + w, y });
  expectPoint(card?.[2], { x: x + w, y: y + h });
  expectPoint(card?.[3], { x, y: y + h });
}

describe('detectCards', () => {
  it('finds two charts from left to right with the corners clockwise', () => {
    // The right chart is drawn first: the position in the image counts, not the order.
    const frame = scene((f) => {
      drawCard(f, 380, 60, 160, 250);
      drawCard(f, 90, 70, 170, 260);
    });
    const cards = detectCards(frame, 2);
    expect(cards).toHaveLength(2);
    expectCard(cards?.[0], 90, 70, 170, 260);
    expectCard(cards?.[1], 380, 60, 160, 250);
  });

  it('also detects a laterally distorted chart', () => {
    const frame = scene((f) => {
      drawCard(f, 100, 60, 160, 250, { shear: 24 });
    });
    const [card] = detectCards(frame, 1) ?? [];
    expectPoint(card?.[0], { x: 100, y: 60 });
    expectPoint(card?.[1], { x: 260, y: 60 });
    expectPoint(card?.[2], { x: 284, y: 310 });
    expectPoint(card?.[3], { x: 124, y: 310 });
  });

  it('also finds charts whose frame appears brighter in dim light', () => {
    const frame = scene((f) => {
      drawCard(f, 100, 60, 160, 250, { dark: 0.28 });
    });
    expectCard(detectCards(frame, 1)?.[0], 100, 60, 160, 250);
  });

  it('also finds a gray frame, as a webcam delivers in bright light', () => {
    const frame = scene((f) => {
      drawCard(f, 100, 60, 160, 250, { dark: 0.42 });
    });
    expectCard(detectCards(frame, 1)?.[0], 100, 60, 160, 250);
  });

  it('also finds the corners with tabs in the top and bottom edges', () => {
    const frame = scene((f) => {
      drawCard(f, 100, 60, 160, 250, { tabs: true });
    });
    expectCard(detectCards(frame, 1)?.[0], 100, 60, 160, 250);
  });

  it('detects a perspective-distorted chart (a bit narrower at the top)', () => {
    const frame = scene((f) => {
      for (let y = 60; y < 310; y++) {
        const inset = Math.round(((310 - y) / 250) * 10);
        for (let x = 100 + inset; x < 260 - inset; x++) {
          const inside = x >= 100 + inset + 20 && x < 260 - inset - 20 && y >= 80 && y < 290;
          paint(f, x, y, inside ? 0.8 : 0.08);
        }
      }
    });
    const [card] = detectCards(frame, 1) ?? [];
    expectPoint(card?.[0], { x: 110, y: 60 });
    expectPoint(card?.[1], { x: 250, y: 60 });
    expectPoint(card?.[2], { x: 260, y: 310 });
    expectPoint(card?.[3], { x: 100, y: 310 });
  });

  it('detects nothing in a blurred image', () => {
    const sharp = scene((f) => {
      drawCard(f, 100, 60, 160, 250, { tabs: true });
    });
    // Average of eight mutually shifted images, like a shot from a moving hand.
    const data = new Float32Array(sharp.data.length);
    for (let step = 0; step < 8; step++) {
      const dx = Math.round((step * 70) / 7);
      const dy = Math.round((step * 30) / 7);
      for (let y = 0; y < SIZE.height; y++) {
        for (let x = 0; x < SIZE.width; x++) {
          const from =
            (Math.min(y + dy, SIZE.height - 1) * SIZE.width + Math.min(x + dx, SIZE.width - 1)) * 3;
          for (let c = 0; c < 3; c++) {
            const to = (y * SIZE.width + x) * 3 + c;
            data[to] = Number(data[to]) + Number(sharp.data[from + c]) / 8;
          }
        }
      }
    }
    expect(detectCards({ ...SIZE, data }, 1)).toBeNull();
  });

  it('rejects two charts that do not match each other', () => {
    const frame = scene((f) => {
      drawCard(f, 60, 60, 170, 260);
      drawCard(f, 380, 120, 100, 160);
    });
    expect(detectCards(frame, 2)).toBeNull();
  });

  it('works on a downscaled copy for larger images', () => {
    const width = 1280;
    const height = 720;
    const frame = { width, height, data: new Float32Array(width * height * 3).fill(BACKGROUND) };
    drawCard(frame, 300, 100, 340, 520);
    expectCard(detectCards(frame, 1)?.[0], 300, 100, 340, 520);
  });

  it('returns null when the number of charts is wrong', () => {
    const oneCard = scene((f) => {
      drawCard(f, 90, 70, 170, 260);
    });
    expect(detectCards(oneCard, 2)).toBeNull();
  });

  it('finds nothing in a uniform image', () => {
    expect(
      detectCards(
        scene(() => {
          // empty image
        }),
        1,
      ),
    ).toBeNull();
  });

  it('ignores dark areas at the image edge, too small ones and landscape ones', () => {
    const frame = scene((f) => {
      drawCard(f, 90, 70, 170, 260);
      // At the left image edge (like a dark object behind the charts).
      drawCard(f, 0, 100, 50, 200);
      // Too small.
      drawCard(f, 400, 20, 20, 30);
      // Landscape.
      drawCard(f, 300, 200, 300, 120);
    });
    expect(detectCards(frame, 1)).toHaveLength(1);
  });
});

describe('sameCards', () => {
  const card = (x: number): Corners => [
    { x, y: 0 },
    { x: x + 10, y: 0 },
    { x: x + 10, y: 20 },
    { x, y: 20 },
  ];

  it('accepts corners within the tolerance', () => {
    expect(sameCards([card(0), card(50)], [card(3), card(48)], 5)).toBe(true);
  });

  it('rejects corners that moved too far or a different number of charts', () => {
    expect(sameCards([card(0)], [card(30)], 5)).toBe(false);
    expect(sameCards([card(0), card(50)], [card(0)], 5)).toBe(false);
  });
});
