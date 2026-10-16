import { readFileSync } from 'node:fs';
import path from 'node:path';

import { parseLayout } from '../../src/chart/layout';

export const WIDTH = 1280;
export const HEIGHT = 720;

// Pixelrechtecke der beiden Graukarten im synthetischen Kamerabild.
export const CARD_PIXELS = {
  3: { x: 100, y: 50, w: 400, h: 600 },
  4: { x: 700, y: 50, w: 400, h: 600 },
} as const;

type CardNumber = keyof typeof CARD_PIXELS;

// Helligkeiten (sRGB-codiert, 0..1) der Felder einer Beleuchtungssituation.
interface Lighting {
  large18: number;
  large50: number;
  stripDark: number;
  stripLight: number;
}

const LIGHTINGS = {
  ok: { large18: 0.46, large50: 0.74, stripDark: 0.12, stripLight: 0.85 },
  dark: { large18: 0.3, large50: 0.58, stripDark: 0.05, stripLight: 0.6 },
  bright: { large18: 0.62, large50: 0.88, stripDark: 0.2, stripLight: 0.97 },
} as const satisfies Record<string, Lighting>;

export type LightingName = keyof typeof LIGHTINGS;

// Ein gefülltes Rechteck des synthetischen Bildes (Pixel, Grauwert 0..255).
interface SceneRect {
  x: number;
  y: number;
  w: number;
  h: number;
  gray: number;
}

export interface Scene {
  width: number;
  height: number;
  rects: SceneRect[];
}

const SURROUND = 0.35;
const CARD_SURFACE = 0.05;

const layout = parseLayout(
  JSON.parse(
    readFileSync(
      path.join(import.meta.dirname, '../../src/data/layouts/spyder-checkr-photo-gray.layout.json'),
      'utf8',
    ),
  ),
);

function toGray(value: number): number {
  return Math.round(value * 255);
}

function stripValue(lighting: Lighting, id: string): number {
  const index = Number(id.slice(id.indexOf('-') + 1));
  return lighting.stripDark + ((lighting.stripLight - lighting.stripDark) * index) / 5;
}

function largeValue(lighting: Lighting, id: string): number {
  return id === 'G18' ? lighting.large18 : lighting.large50;
}

// Beschreibt beide Graukarten mit den Feldern aus dem Layout als Liste gefüllter Rechtecke.
// Der Browser zeichnet daraus per Canvas das Kamerabild.
export function sceneFor(name: LightingName): Scene {
  const lighting = LIGHTINGS[name];
  const rects: SceneRect[] = [{ x: 0, y: 0, w: WIDTH, h: HEIGHT, gray: toGray(SURROUND) }];
  for (const card of layout.cards) {
    const pixels = CARD_PIXELS[card.card as CardNumber];
    rects.push({ ...pixels, gray: toGray(CARD_SURFACE) });
    for (const patch of card.patches) {
      const value =
        patch.role === 'large' ? largeValue(lighting, patch.id) : stripValue(lighting, patch.id);
      rects.push({
        x: pixels.x + patch.rect.x * pixels.w,
        y: pixels.y + patch.rect.y * pixels.h,
        w: patch.rect.w * pixels.w,
        h: patch.rect.h * pixels.h,
        gray: toGray(value),
      });
    }
  }
  return { width: WIDTH, height: HEIGHT, rects };
}
