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

// Wird im Browser ausgeführt und muss deshalb vollständig in sich geschlossen sein.
function installInPage({ scenes, initial, redrawMs, frameRate }: Options): void {
  const first = scenes[initial];
  if (first === undefined) {
    throw new Error('Unbekannte Szene.');
  }
  const canvas = document.createElement('canvas');
  canvas.width = first.width;
  canvas.height = first.height;
  const context = canvas.getContext('2d');
  if (context === null) {
    throw new Error('Canvas-Kontext fehlt.');
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
  // Regelmäßig neu zeichnen und einen Pixel in der Ecke wechseln, damit der Stream laufend
  // neue Bilder liefert (identischer Inhalt würde keinen neuen Frame erzeugen).
  setInterval(() => {
    draw();
    tick += 1;
    const level = 60 + (tick % 2) * 40;
    context.fillStyle = `rgb(${String(level)}, ${String(level)}, ${String(level)})`;
    context.fillRect(0, 0, 2, 2);
  }, redrawMs);

  // Steuerung für die Tests: andere Karten vor die Kamera halten.
  Object.assign(globalThis, {
    setSyntheticScene: (name: string) => {
      const next = scenes[name];
      if (next === undefined) {
        throw new Error(`Unbekannte Szene: ${name}`);
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
        label: 'Synthetische Kamera',
        toJSON: () => ({}),
      },
    ]);
}

// Ersetzt die Kamera der Seite durch einen Canvas-Stream mit den synthetischen Karten.
// Das funktioniert in Chrome und Firefox gleichermaßen (Firefox kennt keine Video-Datei als Kamera).
export async function installSyntheticCamera(page: Page, lighting: LightingName): Promise<void> {
  const scenes = Object.fromEntries(SCENE_NAMES.map((name) => [name, sceneFor(name)]));
  await page.addInitScript(installInPage, {
    scenes,
    initial: lighting,
    redrawMs: REDRAW_MS,
    frameRate: FRAME_RATE,
  });
}

// Hält andere Karten vor die Kamera und wartet, bis das neue Bild im Videoelement ankommt.
export async function showScene(page: Page, name: SceneName): Promise<void> {
  await page.evaluate((scene) => {
    (globalThis as unknown as { setSyntheticScene: (name: string) => void }).setSyntheticScene(
      scene,
    );
  }, name);
  // Prüfpunkt: Mitte des zuletzt gezeichneten Feldes der Szene.
  const probe = sceneFor(name).rects.at(-1);
  if (probe === undefined) {
    throw new Error('Die Szene ist leer.');
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
