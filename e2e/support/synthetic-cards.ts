import { readFileSync } from 'node:fs';
import path from 'node:path';

import { parseLayout } from '../../src/chart/layout';
import { dummyLab } from '../../src/test-support/dummy-reference';
import { cameraCode } from '../../src/test-support/synthetic-camera';

const WIDTH = 1280;
const HEIGHT = 720;

// Pixel rectangles of the card pairs in the synthetic camera image (gray cards 3 and 4, color
// cards 1 and 2).
const CARD_PIXELS = {
  1: { x: 100, y: 50, w: 400, h: 600 },
  2: { x: 700, y: 50, w: 400, h: 600 },
  3: { x: 100, y: 50, w: 400, h: 600 },
  4: { x: 700, y: 50, w: 400, h: 600 },
} as const;

type CardNumber = keyof typeof CARD_PIXELS;

// Brightness values (sRGB-encoded, 0..1) of the patches of a lighting situation.
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

// Lightings of the gray cards; "colors" shows the color cards instead (step 2).
export type LightingName = keyof typeof LIGHTINGS;
export type SceneName = LightingName | 'colors';

// One filled rectangle of the synthetic image (pixels, color 0..255).
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

// Describes both gray cards with the patches from the layout as a list of filled rectangles.
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

// Both color cards: each patch shows what the artificial webcam reports for the (made-up)
// reference value.
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

// Center (pixels in the camera image) of a color patch of the synthetic color cards.
export function colorPatchCenter(id: string): { x: number; y: number } {
  for (const card of colorLayout.cards) {
    const patch = card.patches.find((entry) => entry.id === id);
    if (patch !== undefined) {
      const pixels = CARD_PIXELS[card.card as CardNumber];
      return {
        x: pixels.x + (patch.rect.x + patch.rect.w / 2) * pixels.w,
        y: pixels.y + (patch.rect.y + patch.rect.h / 2) * pixels.h,
      };
    }
  }
  throw new Error(`Unknown color patch: ${id}`);
}

export function sceneFor(name: SceneName): Scene {
  return name === 'colors' ? colorScene() : grayScene(name);
}

export const SCENE_NAMES: readonly SceneName[] = ['ok', 'dark', 'bright', 'colors'];
