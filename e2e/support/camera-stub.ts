import type { Page } from '@playwright/test';

import { sceneFor } from './synthetic-cards';
import type { LightingName, Scene } from './synthetic-cards';

const REDRAW_MS = 100;
const FRAME_RATE = 30;

interface Options {
  scene: Scene;
  redrawMs: number;
  frameRate: number;
}

// Wird im Browser ausgeführt und muss deshalb vollständig in sich geschlossen sein.
function installInPage({ scene, redrawMs, frameRate }: Options): void {
  const canvas = document.createElement('canvas');
  canvas.width = scene.width;
  canvas.height = scene.height;
  const context = canvas.getContext('2d');
  if (context === null) {
    throw new Error('Canvas-Kontext fehlt.');
  }
  const draw = () => {
    for (const rect of scene.rects) {
      context.fillStyle = `rgb(${String(rect.gray)}, ${String(rect.gray)}, ${String(rect.gray)})`;
      context.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
  };
  draw();
  // Regelmäßiges Neuzeichnen, damit der Stream laufend Bilder liefert.
  setInterval(draw, redrawMs);

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
  await page.addInitScript(installInPage, {
    scene: sceneFor(lighting),
    redrawMs: REDRAW_MS,
    frameRate: FRAME_RATE,
  });
}
