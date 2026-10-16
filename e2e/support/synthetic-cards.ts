import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

const SURROUND = 0.35;
const CARD_SURFACE = 0.05;
const FRAMES = 3;

const layout = parseLayout(
  JSON.parse(
    readFileSync(
      path.join(import.meta.dirname, '../../src/data/layouts/spyder-checkr-photo-gray.layout.json'),
      'utf8',
    ),
  ),
);

function fill(plane: Uint8Array, x0: number, y0: number, w: number, h: number, value: number) {
  const code = Math.round(value * 255);
  for (let y = Math.round(y0); y < Math.round(y0 + h); y++) {
    plane.fill(code, y * WIDTH + Math.round(x0), y * WIDTH + Math.round(x0 + w));
  }
}

function stripValue(lighting: Lighting, id: string): number {
  const index = Number(id.slice(id.indexOf('-') + 1));
  return lighting.stripDark + ((lighting.stripLight - lighting.stripDark) * index) / 5;
}

function largeValue(lighting: Lighting, id: string): number {
  return id === 'G18' ? lighting.large18 : lighting.large50;
}

// Zeichnet beide Graukarten mit den Feldern aus dem Layout als Graustufen-Bild (Y-Ebene).
function renderLumaPlane(lighting: Lighting): Uint8Array {
  const plane = new Uint8Array(WIDTH * HEIGHT);
  fill(plane, 0, 0, WIDTH, HEIGHT, SURROUND);
  for (const card of layout.cards) {
    const pixels = CARD_PIXELS[card.card as CardNumber];
    fill(plane, pixels.x, pixels.y, pixels.w, pixels.h, CARD_SURFACE);
    for (const patch of card.patches) {
      const value =
        patch.role === 'large' ? largeValue(lighting, patch.id) : stripValue(lighting, patch.id);
      fill(
        plane,
        pixels.x + patch.rect.x * pixels.w,
        pixels.y + patch.rect.y * pixels.h,
        patch.rect.w * pixels.w,
        patch.rect.h * pixels.h,
        value,
      );
    }
  }
  return plane;
}

// Ein Y4M-Video (4:2:0, neutrale Chroma) mit mehreren gleichen Bildern, das Chrome als Kamera abspielt.
function buildY4m(lighting: Lighting): Buffer {
  const luma = renderLumaPlane(lighting);
  const chroma = new Uint8Array((WIDTH / 2) * (HEIGHT / 2)).fill(128);
  const header = Buffer.from(
    `YUV4MPEG2 W${String(WIDTH)} H${String(HEIGHT)} F30:1 Ip A1:1 C420jpeg\n`,
  );
  const frame = Buffer.concat([Buffer.from('FRAME\n'), luma, chroma, chroma]);
  return Buffer.concat([header, ...Array.from({ length: FRAMES }, () => frame)]);
}

const GENERATED_DIR = path.join(import.meta.dirname, '..', '.generated');

export function videoPath(name: LightingName): string {
  return path.join(GENERATED_DIR, `${name}.y4m`);
}

export function writeAllVideos(): void {
  mkdirSync(GENERATED_DIR, { recursive: true });
  for (const name of Object.keys(LIGHTINGS) as LightingName[]) {
    writeFileSync(videoPath(name), buildY4m(LIGHTINGS[name]));
  }
}
