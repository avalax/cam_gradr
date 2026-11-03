import { describe, expect, it } from 'vitest';

import type { Frame } from '../camera/frame';

import { detectCards, detectOutlines, sameCards } from './detect';
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

  it('also finds small charts, held at the distance of the subject (about 17 % of the image height)', () => {
    const frame = scene((f) => {
      drawCard(f, 250, 150, 38, 60);
      drawCard(f, 302, 150, 38, 60);
    });
    const cards = detectCards(frame, 2);
    expect(cards).toHaveLength(2);
    expectCard(cards?.[0], 250, 150, 38, 60);
    expectCard(cards?.[1], 302, 150, 38, 60);
  });

  it('returns null when the number of charts is wrong', () => {
    const oneCard = scene((f) => {
      drawCard(f, 90, 70, 170, 260);
    });
    expect(detectCards(oneCard, 2)).toBeNull();
  });

  it('picks the matching pair out of three charts', () => {
    const frame = scene((f) => {
      drawCard(f, 60, 60, 170, 260);
      drawCard(f, 300, 60, 170, 260);
      // Much smaller than the other two: does not fit the pair.
      drawCard(f, 520, 150, 90, 140);
    });
    const found = detectCards(frame, 2);
    expect(found).toHaveLength(2);
    expectPoint(found?.[0]?.[0], { x: 60, y: 60 });
    expectPoint(found?.[1]?.[0], { x: 300, y: 60 });
  });

  it('takes two of three equal charts', () => {
    const frame = scene((f) => {
      drawCard(f, 20, 60, 170, 260);
      drawCard(f, 230, 60, 170, 260);
      drawCard(f, 440, 60, 170, 260);
    });
    expect(detectCards(frame, 2)).toHaveLength(2);
  });

  it('rejects charts that are stacked instead of side by side', () => {
    const frame = scene((f) => {
      drawCard(f, 200, 10, 110, 160);
      drawCard(f, 200, 190, 110, 160);
    });
    expect(detectCards(frame, 2)).toBeNull();
  });

  it('keeps the tighter frame when a shadow next to the chart makes the dark area larger', () => {
    // A medium dark shadow strip to the right of the chart joins the area at higher thresholds.
    const frame = scene((f) => {
      drawCard(f, 100, 60, 160, 250, { tabs: true });
      for (let y = 60; y < 310; y++) {
        for (let x = 260; x < 300; x++) {
          paint(f, x, y, 0.28);
        }
      }
    });
    const card = detectCards(frame, 1)?.[0];
    expectPoint(card?.[1], { x: 260, y: 60 });
    expectPoint(card?.[2], { x: 260, y: 310 });
  });

  it('still finds a chart whose edge is slightly jagged', () => {
    const frame = scene((f) => {
      drawCard(f, 100, 60, 160, 250);
      // Jagged right edge (e.g. a noisy image): the edge is no longer perfectly straight.
      for (let y = 60; y < 310; y++) {
        const bump = Math.round(7 * Math.sin(y / 2));
        for (let x = 260; x < 260 + bump; x++) {
          paint(f, x, y, 0.08);
        }
      }
    });
    expect(detectCards(frame, 1)).toHaveLength(1);
  });

  it('takes neither a flat nor a narrow dark line for a chart', () => {
    // Both are large enough as dark areas, but only a few pixels high or wide.
    const frame = scene((f) => {
      for (let y = 100; y < 104; y++) {
        for (let x = 100; x < 400; x++) {
          paint(f, x, y, 0.08);
        }
      }
      for (let y = 150; y < 330; y++) {
        for (let x = 500; x < 504; x++) {
          paint(f, x, y, 0.08);
        }
      }
    });
    expect(detectCards(frame, 1)).toBeNull();
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

// Sharp edges at fractions of a pixel: each pixel is covered by the share of its area that lies in
// the rectangle (like a camera sensor integrates the light).
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function cover(frame: Frame, box: Box, value: number): void {
  for (let y = Math.floor(box.y); y < Math.ceil(box.y + box.h); y++) {
    const rows = Math.min(y + 1, box.y + box.h) - Math.max(y, box.y);
    for (let x = Math.floor(box.x); x < Math.ceil(box.x + box.w); x++) {
      const share = rows * (Math.min(x + 1, box.x + box.w) - Math.max(x, box.x));
      const offset = (y * frame.width + x) * 3;
      const blended = Number(frame.data[offset]) * (1 - share) + value * share;
      frame.data.set([blended, blended, blended], offset);
    }
  }
}

// A 1280 × 720 image (downscaled by 4 for the search) with two charts at fractional positions.
const BOXES: readonly Box[] = [
  { x: 300.3, y: 150.6, w: 240.4, h: 360.7 },
  { x: 700.8, y: 150.2, w: 240.6, h: 360.3 },
];

function fineScene(paint: (frame: Frame, box: Box) => void, surround = 0.6): Frame {
  const frame = { width: 1280, height: 720, data: new Float32Array(1280 * 720 * 3).fill(surround) };
  for (const box of BOXES) {
    paint(frame, box);
    cover(frame, { x: box.x + 30, y: box.y + 30, w: box.w - 60, h: box.h - 60 }, 0.8);
  }
  return frame;
}

function expectCorners(cards: Corners[] | null, tolerance: number): void {
  expect(cards).toHaveLength(2);
  for (const [index, box] of BOXES.entries()) {
    const expected = [
      { x: box.x, y: box.y },
      { x: box.x + box.w, y: box.y },
      { x: box.x + box.w, y: box.y + box.h },
      { x: box.x, y: box.y + box.h },
    ];
    for (const [corner, point] of expected.entries()) {
      expect(Math.abs(Number(cards?.[index]?.[corner]?.x) - point.x)).toBeLessThan(tolerance);
      expect(Math.abs(Number(cards?.[index]?.[corner]?.y) - point.y)).toBeLessThan(tolerance);
    }
  }
}

describe('detectCards at full resolution', () => {
  it('finds the edges of the charts to a fraction of a pixel, although it searches downscaled', () => {
    const frame = fineScene((f, box) => {
      cover(f, box, 0.05);
    });
    expectCorners(detectCards(frame, 2), 0.5);
  });

  it('takes the edge of the chart, not the gray shadow of the case wall next to it', () => {
    const frame = fineScene((f, box) => {
      // A gray band of 9 pixels around the chart, then the light case.
      cover(f, { x: box.x - 9, y: box.y - 9, w: box.w + 18, h: box.h + 18 }, 0.2);
      cover(f, box, 0.05);
    });
    expectCorners(detectCards(frame, 2), 0.5);
  });

  it('takes the middle of a slow ramp, as a bright shot blurs the edge', () => {
    const frame = fineScene((f, box) => {
      // Twelve rings, each a bit darker, from the case down to the frame.
      for (let ring = 6; ring > -6; ring--) {
        const value = 0.6 - (0.55 * (6 - ring)) / 12;
        cover(
          f,
          { x: box.x - ring, y: box.y - ring, w: box.w + 2 * ring, h: box.h + 2 * ring },
          value,
        );
      }
      cover(f, { x: box.x + 6, y: box.y + 6, w: box.w - 12, h: box.h - 12 }, 0.05);
    });
    // Within a ramp of 12 pixels the edge is only known roughly; the foot of the ramp, which the
    // first step alone would take, lies about 5 pixels inside.
    expectCorners(detectCards(frame, 2), 2.5);
  });

  it('keeps the edge of the downscaled search where the surround is hardly brighter', () => {
    // The surround only slightly brighter than the frame: still found, but not refined.
    const frame = fineScene((f, box) => {
      cover(f, box, 0.08);
    }, 0.12);
    expectCorners(detectCards(frame, 2), 8);
  });
});

describe('detectOutlines', () => {
  it('returns both charts as soon as both are there, like detectCards', () => {
    const frame = scene((f) => {
      drawCard(f, 380, 60, 160, 250);
      drawCard(f, 90, 70, 170, 260);
    });
    expect(detectOutlines(frame, 2)).toEqual(detectCards(frame, 2));
  });

  it('returns the one chart that is found while the other is missing', () => {
    const frame = scene((f) => {
      drawCard(f, 90, 70, 170, 260);
    });
    const outlines = detectOutlines(frame, 2);
    expect(outlines).toHaveLength(1);
    expectCard(outlines[0], 90, 70, 170, 260);
  });

  it('returns nothing in an image without charts', () => {
    const frame = scene(() => {
      // No charts drawn.
    });
    expect(detectOutlines(frame, 2)).toEqual([]);
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
