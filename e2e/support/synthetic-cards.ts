import { colorLayout, grayLayout } from '../../src/chart/layouts';
import type { Vec3 } from '../../src/color/lab';
import { CARD_LEFTS, cardRect } from '../../src/test-support/cards';
import { dummyLab } from '../../src/test-support/dummy-reference';
import { cameraCode } from '../../src/test-support/synthetic-camera';

const WIDTH = 1280;
const HEIGHT = 720;

// Pixel rectangles of the card pairs in the synthetic camera image (gray cards 3 and 4, color
// cards 1 and 2), where the unit tests place them too.
const [LEFT, RIGHT] = CARD_LEFTS;
const CARD_PIXELS = {
  1: cardRect(LEFT),
  2: cardRect(RIGHT),
  3: cardRect(LEFT),
  4: cardRect(RIGHT),
};

type CardNumber = keyof typeof CARD_PIXELS;

// Brightness values (sRGB-encoded, 0..1) of the gray patches in a well lit room. Too dark and too
// bright rooms are covered by the unit tests of the rating.
const LIGHTING = { large18: 0.46, large50: 0.74, stripDark: 0.12, stripLight: 0.85 };

// The gray cards or the color cards (step 2).
export type SceneName = 'gray' | 'colors';

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
  // A drawing (SVG markup) over the rectangles, stretched to the whole image.
  svg?: string;
}

const SURROUND = 0.35;
const CARD_SURFACE = 0.05;

function toGray(value: number): [number, number, number] {
  const code = Math.round(value * 255);
  return [code, code, code];
}

function stripValue(id: string): number {
  const index = Number(id.slice(id.indexOf('-') + 1));
  return LIGHTING.stripDark + ((LIGHTING.stripLight - LIGHTING.stripDark) * index) / 5;
}

function largeValue(id: string): number {
  return id === 'G18' ? LIGHTING.large18 : LIGHTING.large50;
}

function background(): SceneRect {
  return { x: 0, y: 0, w: WIDTH, h: HEIGHT, color: toGray(SURROUND) };
}

// Describes both gray cards with the patches from the layout as a list of filled rectangles.
function grayScene(): Scene {
  const rects: SceneRect[] = [background()];
  for (const card of grayLayout.cards) {
    const pixels = CARD_PIXELS[card.card as CardNumber];
    rects.push({ ...pixels, color: toGray(CARD_SURFACE) });
    for (const patch of card.patches) {
      const value = patch.role === 'large' ? largeValue(patch.id) : stripValue(patch.id);
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

// Both color cards: each patch shows what the camera reports for the reference value, by default
// the artificial webcam and the made-up values.
export function colorScene(
  labOf: (id: string) => Vec3 = dummyLab,
  camera: (lab: Vec3) => Vec3 = cameraCode,
): Scene {
  const rects: SceneRect[] = [background()];
  for (const card of colorLayout.cards) {
    const pixels = CARD_PIXELS[card.card as CardNumber];
    rects.push({ ...pixels, color: toGray(CARD_SURFACE) });
    for (const patch of card.patches) {
      const [r, g, b] = camera(labOf(patch.id));
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
  return name === 'colors' ? colorScene() : grayScene();
}

export const SCENE_NAMES: readonly SceneName[] = ['gray', 'colors'];
