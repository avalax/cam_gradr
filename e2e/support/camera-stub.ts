import type { Page } from '@playwright/test';

import { SCENE_NAMES, sceneFor } from './synthetic-cards';
import type { LightingName, Scene, SceneName } from './synthetic-cards';

const REDRAW_MS = 100;
const FRAME_RATE = 30;

interface Options {
  scenes: Record<string, Scene>;
  initial: string;
  redrawMs: number;
  frameRate: number;
}

// Runs in the browser and must therefore be completely self-contained.
function installInPage({ scenes, initial, redrawMs, frameRate }: Options): void {
  const first = scenes[initial];
  if (first === undefined) {
    throw new Error('Unknown scene.');
  }
  const canvas = document.createElement('canvas');
  canvas.width = first.width;
  canvas.height = first.height;
  const context = canvas.getContext('2d');
  if (context === null) {
    throw new Error('Canvas context is missing.');
  }
  let current: Scene = first;
  const draw = () => {
    for (const rect of current.rects) {
      const [r, g, b] = rect.color;
      context.fillStyle = `rgb(${String(r)}, ${String(g)}, ${String(b)})`;
      context.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
  };
  let tick = 0;
  draw();
  // Redraw regularly and change a pixel in the corner so that the stream keeps delivering new
  // images (identical content would not produce a new frame).
  setInterval(() => {
    draw();
    tick += 1;
    const level = 60 + (tick % 2) * 40;
    context.fillStyle = `rgb(${String(level)}, ${String(level)}, ${String(level)})`;
    context.fillRect(0, 0, 2, 2);
  }, redrawMs);

  // Control for the tests: hold other cards in front of the camera.
  Object.assign(globalThis, {
    setSyntheticScene: (name: string) => {
      const next = scenes[name];
      if (next === undefined) {
        throw new Error(`Unknown scene: ${name}`);
      }
      current = next;
      draw();
    },
  });

  const devices = navigator.mediaDevices;
  devices.getUserMedia = () => Promise.resolve(canvas.captureStream(frameRate));
  devices.enumerateDevices = () =>
    Promise.resolve([
      {
        kind: 'videoinput',
        deviceId: 'synthetic-camera',
        groupId: 'synthetic',
        label: 'Synthetic camera',
        toJSON: () => ({}),
      },
    ]);
}

// Replaces the camera of the page with a canvas stream showing the synthetic cards.
// This works in Chrome and Firefox alike (Firefox cannot use a video file as a camera).
export async function installSyntheticCamera(page: Page, lighting: LightingName): Promise<void> {
  const scenes = Object.fromEntries(SCENE_NAMES.map((name) => [name, sceneFor(name)]));
  await page.addInitScript(installInPage, {
    scenes,
    initial: lighting,
    redrawMs: REDRAW_MS,
    frameRate: FRAME_RATE,
  });
}

// Sets the scene without waiting for the video image (the camera may still be off).
export async function setScene(page: Page, name: SceneName): Promise<void> {
  await page.evaluate((scene) => {
    (globalThis as unknown as { setSyntheticScene: (name: string) => void }).setSyntheticScene(
      scene,
    );
  }, name);
}

// Holds other cards in front of the camera and waits until the new image arrives in the video
// element.
export async function showScene(page: Page, name: SceneName): Promise<void> {
  await setScene(page, name);
  // Probe point: center of the last drawn patch of the scene.
  const probe = sceneFor(name).rects.at(-1);
  if (probe === undefined) {
    throw new Error('The scene is empty.');
  }
  await page.waitForFunction(
    ({ x, y, color }) => {
      const video = document.querySelector('video');
      if (video === null || video.videoWidth === 0) {
        return false;
      }
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (context === null) {
        return false;
      }
      context.drawImage(video, 0, 0);
      const pixel = context.getImageData(Math.round(x), Math.round(y), 1, 1).data;
      return [0, 1, 2].every((index) => Math.abs((pixel[index] ?? 0) - (color[index] ?? 0)) < 8);
    },
    {
      x: probe.x + probe.w / 2,
      y: probe.y + probe.h / 2,
      color: probe.color,
    },
  );
}
