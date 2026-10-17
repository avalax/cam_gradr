import { describe, expect, it } from 'vitest';

import type { Frame } from '../camera/frame';

import { detectCards, sameCards } from './detect';
import type { Corners, Point } from './types';

const SIZE = { width: 640, height: 360 };
const TOLERANCE = 12;
const BACKGROUND = 0.6;

interface CardOptions {
  // Helligkeit des dunklen Rahmens.
  dark?: number;
  // Seitlicher Versatz der Unterkante gegenüber der Oberkante (Parallelogramm).
  shear?: number;
  // Helle Laschen in der Mitte von Ober- und Unterkante (wie bei den echten Karten).
  tabs?: boolean;
}

function paint(frame: Frame, x: number, y: number, value: number) {
  frame.data.set([value, value, value], (y * frame.width + x) * 3);
}

// Lasche: Mitte von Ober- und Unterkante (Spalte als Anteil der Breite, Zeile ab Oberkante).
function isTab(column: number, row: number, height: number): boolean {
  return column > 0.3 && column < 0.7 && (row < 14 || height - row <= 14);
}

// Helligkeit eines Punkts der Karte: innen helle Felder (mit Rand), sonst der dunkle Rahmen.
function cardValue(column: number, row: number, w: number, h: number, o: CardOptions): number {
  const border = Math.round(w / 8);
  const inside = column >= border && column < w - border && row >= border && row < h - border;
  return inside || (o.tabs === true && isTab(column / w, row, h)) ? 0.8 : (o.dark ?? 0.08);
}

// Karte mit dunklem Rahmen und hellen Feldern innen (wie die echten Karten).
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
  it('findet zwei Karten von links nach rechts mit den Ecken im Uhrzeigersinn', () => {
    // Die rechte Karte wird zuerst gezeichnet: die Lage im Bild zählt, nicht die Reihenfolge.
    const frame = scene((f) => {
      drawCard(f, 380, 60, 160, 250);
      drawCard(f, 90, 70, 170, 260);
    });
    const cards = detectCards(frame, 2);
    expect(cards).toHaveLength(2);
    expectCard(cards?.[0], 90, 70, 170, 260);
    expectCard(cards?.[1], 380, 60, 160, 250);
  });

  it('erkennt auch eine seitlich verzerrte Karte', () => {
    const frame = scene((f) => {
      drawCard(f, 100, 60, 160, 250, { shear: 24 });
    });
    const [card] = detectCards(frame, 1) ?? [];
    expectPoint(card?.[0], { x: 100, y: 60 });
    expectPoint(card?.[1], { x: 260, y: 60 });
    expectPoint(card?.[2], { x: 284, y: 310 });
    expectPoint(card?.[3], { x: 124, y: 310 });
  });

  it('findet auch Karten, deren Rahmen im schwachen Licht heller erscheint', () => {
    const frame = scene((f) => {
      drawCard(f, 100, 60, 160, 250, { dark: 0.28 });
    });
    expectCard(detectCards(frame, 1)?.[0], 100, 60, 160, 250);
  });

  it('findet auch einen grauen Rahmen, wie ihn eine Webcam bei hellem Licht liefert', () => {
    const frame = scene((f) => {
      drawCard(f, 100, 60, 160, 250, { dark: 0.42 });
    });
    expectCard(detectCards(frame, 1)?.[0], 100, 60, 160, 250);
  });

  it('findet die Ecken auch mit Laschen in Ober- und Unterkante', () => {
    const frame = scene((f) => {
      drawCard(f, 100, 60, 160, 250, { tabs: true });
    });
    expectCard(detectCards(frame, 1)?.[0], 100, 60, 160, 250);
  });

  it('erkennt eine perspektivisch verzerrte Karte (oben etwas schmaler als unten)', () => {
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

  it('erkennt nichts in einem verwackelten Bild', () => {
    const sharp = scene((f) => {
      drawCard(f, 100, 60, 160, 250, { tabs: true });
    });
    // Mittel aus acht gegeneinander verschobenen Bildern, wie eine Aufnahme aus bewegter Hand.
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

  it('verwirft zwei Karten, die nicht zueinander passen', () => {
    const frame = scene((f) => {
      drawCard(f, 60, 60, 170, 260);
      drawCard(f, 380, 120, 100, 160);
    });
    expect(detectCards(frame, 2)).toBeNull();
  });

  it('arbeitet bei größeren Bildern auf einem verkleinerten Abbild', () => {
    const width = 1280;
    const height = 720;
    const frame = { width, height, data: new Float32Array(width * height * 3).fill(BACKGROUND) };
    drawCard(frame, 300, 100, 340, 520);
    expectCard(detectCards(frame, 1)?.[0], 300, 100, 340, 520);
  });

  it('gibt null zurück, wenn die Zahl der Karten nicht stimmt', () => {
    const oneCard = scene((f) => {
      drawCard(f, 90, 70, 170, 260);
    });
    expect(detectCards(oneCard, 2)).toBeNull();
  });

  it('findet in einem gleichmäßigen Bild nichts', () => {
    expect(
      detectCards(
        scene(() => {
          // leeres Bild
        }),
        1,
      ),
    ).toBeNull();
  });

  it('ignoriert dunkle Flächen am Bildrand, zu kleine und querformatige', () => {
    const frame = scene((f) => {
      drawCard(f, 90, 70, 170, 260);
      // Am linken Bildrand (wie ein dunkler Gegenstand hinter den Karten).
      drawCard(f, 0, 100, 50, 200);
      // Zu klein.
      drawCard(f, 400, 20, 20, 30);
      // Querformatig.
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

  it('akzeptiert Ecken innerhalb der Toleranz', () => {
    expect(sameCards([card(0), card(50)], [card(3), card(48)], 5)).toBe(true);
  });

  it('lehnt zu weit gewanderte Ecken oder eine andere Zahl an Karten ab', () => {
    expect(sameCards([card(0)], [card(30)], 5)).toBe(false);
    expect(sameCards([card(0), card(50)], [card(0)], 5)).toBe(false);
  });
});
