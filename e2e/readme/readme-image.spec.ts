import { readFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import { labToLinearSrgb, srgbToLab } from '../../src/color/lab';
import type { Vec3 } from '../../src/color/lab';
import { linearToSrgb } from '../../src/color/srgb';
import { AppPage } from '../support/app-page';
import { installSyntheticCamera, setScene } from '../support/camera-stub';
import { colorScene, sceneFor } from '../support/synthetic-cards';

import { ROOM_COLORS, roomSvg } from './room';
import type { RoomColors } from './room';

// Not an acceptance test: renders the picture at the top of the README (`npm run readme:image`,
// see playwright.readme.config.ts). The real app measures the cards and calculates the correction;
// the camera then shows a drawn room, and the preview compares it with the corrected image.

const OUTPUT = path.join(import.meta.dirname, '../../docs/preview.png');
const REFERENCE = path.join(
  import.meta.dirname,
  '../../src/data/reference/spyder-checkr-48.reference.json',
);
// A point on the wall right of the divider (camera pixels), where the corrected color is checked.
const WALL = { x: 900, y: 60 };
const TOLERANCE = 12;
// White margin around the app in the picture (CSS pixels).
const MARGIN = 16;

// A webcam with a visible warm and slightly green cast: color mixing (row sum 1), then gain and
// gamma per channel. The tone curves and the matrix of the correction can undo it.
const GAIN: Vec3 = [0.97, 1, 0.8];
const GAMMA: Vec3 = [1.12, 0.95, 0.9];
const MIX: readonly [Vec3, Vec3, Vec3] = [
  [0.86, 0.11, 0.03],
  [0.06, 0.88, 0.06],
  [0.03, 0.14, 0.83],
];

function channel(value: number, index: 0 | 1 | 2): number {
  const clamped = Math.min(Math.max(value, 0), 1);
  return linearToSrgb(Math.min(1, GAIN[index] * clamped ** GAMMA[index]));
}

function webcam(lab: Vec3): Vec3 {
  const [r, g, b] = labToLinearSrgb(lab);
  const [first = 0, second = 0, third = 0] = MIX.map((row) => row[0] * r + row[1] * g + row[2] * b);
  return [channel(first, 0), channel(second, 1), channel(third, 2)];
}

function toCode(hex: string): Vec3 {
  return [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
}

function toHex(code: Vec3): string {
  return `#${code
    .map((value) =>
      Math.round(value * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

// The bundled reference values, so that the side column shows the patches the app ships with.
const reference = JSON.parse(readFileSync(REFERENCE, 'utf8')) as {
  patches: { id: string; lab: Vec3 }[];
};
const bundledLab = new Map(reference.patches.map((patch) => [patch.id, patch.lab]));

function labOf(id: string): Vec3 {
  const lab = bundledLab.get(id);
  if (lab === undefined) {
    throw new Error(`No reference value for patch ${id}.`);
  }
  return lab;
}

// The room as the webcam sees it.
const cameraRoom = Object.fromEntries(
  Object.entries(ROOM_COLORS).map(([key, hex]) => [key, toHex(webcam(srgbToLab(toCode(hex))))]),
) as RoomColors;

test('README picture: the preview of a drawn room', async ({ page }) => {
  await installSyntheticCamera(page, {
    gray: sceneFor('gray'),
    colors: colorScene(labOf, webcam),
    room: { width: 1280, height: 720, rects: [], svg: roomSvg(cameraRoom) },
  });
  const app = new AppPage(page);
  const camera = app.cameraSwitch;
  await page.goto('./');

  // Gray cards: the app finds them, takes a still image and switches the camera off.
  await camera.click();
  await expect(page.locator('svg circle')).toHaveCount(8, { timeout: 20_000 });
  await expect(camera).toHaveAttribute('aria-checked', 'false', { timeout: 20_000 });

  // Color cards: the same, then the correction is calculated.
  await page.locator('#tab-color').click();
  await setScene(page, 'colors');
  await camera.click();
  await expect(page.getByTestId('color-wipe-result')).toBeVisible({ timeout: 20_000 });
  await expect(camera).toHaveAttribute('aria-checked', 'false', { timeout: 20_000 });

  // The live room in the preview: camera on the left, corrected on the right.
  await page.locator('#tab-preview').click();
  await setScene(page, 'room');
  await app.startCamera();
  await app.expectPreviewColor(
    WALL.x,
    WALL.y,
    toCode(ROOM_COLORS.wall).map((value) => Math.round(value * 255)),
    TOLERANCE,
  );

  // Tabs and content with a small margin; without the footer, whose version number would age.
  await page.mouse.move(0, 0);
  const box = await page.locator('main > div').first().boundingBox();
  expect(box).not.toBeNull();
  const { x, y, width, height } = box ?? { x: 0, y: 0, width: 0, height: 0 };
  await page.screenshot({
    path: OUTPUT,
    animations: 'disabled',
    clip: { x: x - MARGIN, y: y - MARGIN, width: width + 2 * MARGIN, height: height + 2 * MARGIN },
  });
});
