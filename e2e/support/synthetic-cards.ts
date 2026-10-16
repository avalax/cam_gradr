import { readFileSync } from 'node:fs';
import path from 'node:path';

import { parseLayout } from '../../src/chart/layout';
import { dummyLab } from '../../src/test-support/dummy-reference';
import { cameraCode } from '../../src/test-support/synthetic-camera';

export const WIDTH = 1280;
export const HEIGHT = 720;

// Pixelrechtecke der Kartenpaare im synthetischen Kamerabild (Graukarten 3 und 4, Farbkarten 1 und 2).
export const CARD_PIXELS = {
  1: { x: 100, y: 50, w: 400, h: 600 },
  2: { x: 700, y: 50, w: 400, h: 600 },
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

// Beleuchtungen der Graukarten; "colors" zeigt stattdessen die Farbkarten (Schritt 2).
export type LightingName = keyof typeof LIGHTINGS;
export type SceneName = LightingName | 'colors';

// Ein gefülltes Rechteck des synthetischen Bildes (Pixel, Farbe 0..255).
interface SceneRect {
  x: number;
  y: number;
  w: number;
  h: number;
  color: [number, number, number];
}

export interface Scene {
  width: number;
  height: number;
  rects: SceneRect[];
}

const SURROUND = 0.35;
const CARD_SURFACE = 0.05;

function readLayout(name: string) {
  return parseLayout(
    JSON.parse(
      readFileSync(path.join(import.meta.dirname, `../../src/data/layouts/${name}`), 'utf8'),
    ),
  );
}

const grayLayout = readLayout('spyder-checkr-photo-gray.layout.json');
const colorLayout = readLayout('spyder-checkr-photo-color.layout.json');

function toGray(value: number): [number, number, number] {
  const code = Math.round(value * 255);
  return [code, code, code];
}

function stripValue(lighting: Lighting, id: string): number {
  const index = Number(id.slice(id.indexOf('-') + 1));
  return lighting.stripDark + ((lighting.stripLight - lighting.stripDark) * index) / 5;
}

function largeValue(lighting: Lighting, id: string): number {
  return id === 'G18' ? lighting.large18 : lighting.large50;
}

function background(): SceneRect {
  return { x: 0, y: 0, w: WIDTH, h: HEIGHT, color: toGray(SURROUND) };
}

// Beschreibt beide Graukarten mit den Feldern aus dem Layout als Liste gefüllter Rechtecke.
function grayScene(name: LightingName): Scene {
  const lighting = LIGHTINGS[name];
  const rects: SceneRect[] = [background()];
  for (const card of grayLayout.cards) {
    const pixels = CARD_PIXELS[card.card as CardNumber];
    rects.push({ ...pixels, color: toGray(CARD_SURFACE) });
    for (const patch of card.patches) {
      const value =
        patch.role === 'large' ? largeValue(lighting, patch.id) : stripValue(lighting, patch.id);
      rects.push({
        x: pixels.x + patch.rect.x * pixels.w,
        y: pixels.y + patch.rect.y * pixels.h,
        w: patch.rect.w * pixels.w,
        h: patch.rect.h * pixels.h,
        color: toGray(value),
      });
    }
  }
  return { width: WIDTH, height: HEIGHT, rects };
}

// Beide Farbkarten: jedes Feld zeigt, was die künstliche Webcam für den (erfundenen) Referenzwert meldet.
function colorScene(): Scene {
  const rects: SceneRect[] = [background()];
  for (const card of colorLayout.cards) {
    const pixels = CARD_PIXELS[card.card as CardNumber];
    rects.push({ ...pixels, color: toGray(CARD_SURFACE) });
    for (const patch of card.patches) {
      const [r, g, b] = cameraCode(dummyLab(patch.id));
      rects.push({
        x: pixels.x + patch.rect.x * pixels.w,
        y: pixels.y + patch.rect.y * pixels.h,
        w: patch.rect.w * pixels.w,
        h: patch.rect.h * pixels.h,
        color: [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)],
      });
    }
  }
  return { width: WIDTH, height: HEIGHT, rects };
}

export function sceneFor(name: SceneName): Scene {
  return name === 'colors' ? colorScene() : grayScene(name);
}

export const SCENE_NAMES: readonly SceneName[] = ['ok', 'dark', 'bright', 'colors'];
