import { describe, expect, it } from 'vitest';

import type { Frame } from '../camera/frame';

import { detectCards } from './detect';
import type { Corners, Point } from './types';

const SIZE = { width: 640, height: 360 };

// Karte aus 4×3 Feldern in verschiedenen Graustufen; `shear` kippt sie seitlich (Parallelogramm),
// damit die Ecken nicht achsparallel liegen.
function drawCard(frame: Frame, x0: number, y0: number, width: number, height: number, shear = 0) {
  for (let y = y0; y < y0 + height; y++) {
    const offset = Math.round(((y - y0) / height) * shear);
    for (let x = x0 + offset; x < x0 + offset + width; x++) {
      const column = Math.floor(((x - x0 - offset) / width) * 4);
      const row = Math.floor(((y - y0) / height) * 3);
      const value = 0.2 + 0.07 * ((column + row * 4) % 8);
      frame.data.set([value, value, value], (y * frame.width + x) * 3);
    }
  }
}

function scene(draw: (frame: Frame) => void): Frame {
  const data = new Float32Array(SIZE.width * SIZE.height * 3).fill(0.5);
  const frame = { ...SIZE, data };
  draw(frame);
  return frame;
}

const TOLERANCE = 12;

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
      drawCard(f, 380, 80, 200, 150);
      drawCard(f, 60, 100, 220, 160);
    });
    const cards = detectCards(frame, 2);
    expect(cards).toHaveLength(2);
    expectCard(cards?.[0], 60, 100, 220, 160);
    expectCard(cards?.[1], 380, 80, 200, 150);
  });

  it('erkennt auch eine seitlich verzerrte Karte', () => {
    const frame = scene((f) => {
      drawCard(f, 100, 100, 200, 150, 30);
    });
    const [card] = detectCards(frame, 1) ?? [];
    expectPoint(card?.[0], { x: 100, y: 100 });
    expectPoint(card?.[1], { x: 300, y: 100 });
    expectPoint(card?.[2], { x: 330, y: 250 });
    expectPoint(card?.[3], { x: 130, y: 250 });
  });

  it('arbeitet bei größeren Bildern auf einem verkleinerten Abbild', () => {
    const width = 1280;
    const height = 720;
    const data = new Float32Array(width * height * 3).fill(0.5);
    for (let y = 200; y < 500; y++) {
      for (let x = 160; x < 640; x++) {
        const cell = (Math.floor((x - 160) / 120) + 4 * Math.floor((y - 200) / 100)) % 8;
        data.fill(0.2 + 0.07 * cell, (y * width + x) * 3, (y * width + x) * 3 + 3);
      }
    }
    expectCard(detectCards({ width, height, data }, 1)?.[0], 160, 200, 480, 300);
  });

  it('gibt null zurück, wenn die Zahl der Karten nicht stimmt', () => {
    const oneCard = scene((f) => {
      drawCard(f, 60, 100, 220, 160);
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

  it('ignoriert kleine Störungen neben den Karten', () => {
    const frame = scene((f) => {
      drawCard(f, 60, 100, 220, 160);
      drawCard(f, 20, 20, 24, 18);
    });
    expect(detectCards(frame, 1)).toHaveLength(1);
  });
});
