import { describe, expect, it } from 'vitest';

import type { Frame } from '../camera/frame';

import { detectCards } from './detect';
import type { Corners, Point } from './types';

const SIZE = { width: 640, height: 360 };
const TOLERANCE = 12;
const BACKGROUND = 0.6;

interface CardOptions {
  // Helligkeit des dunklen Rahmens.
  dark?: number;
  // Seitlicher Versatz der Unterkante gegenüber der Oberkante (Parallelogramm).
  shear?: number;
}

function paint(frame: Frame, x: number, y: number, value: number) {
  frame.data.set([value, value, value], (y * frame.width + x) * 3);
}

// Karte mit dunklem Rahmen und hellen Feldern innen (wie die echten Karten).
function drawCard(frame: Frame, x0: number, y0: number, w: number, h: number, o: CardOptions = {}) {
  const { dark = 0.08, shear = 0 } = o;
  const border = Math.round(w / 8);
  for (let y = y0; y < y0 + h; y++) {
    const offset = Math.round(((y - y0) / h) * shear);
    for (let x = x0 + offset; x < x0 + offset + w; x++) {
      const inside =
        x - x0 - offset >= border &&
        x - x0 - offset < w - border &&
        y - y0 >= border &&
        y - y0 < h - border;
      paint(frame, x, y, inside ? 0.8 : dark);
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
