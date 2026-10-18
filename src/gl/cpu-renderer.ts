import { sampleLut } from '../lut/lut';
import type { Lut } from '../lut/lut';

import type { LutRenderer, RenderSource } from './lut-renderer';

// Software-Darstellung auf der CPU für Browser ohne WebGL2: kleiner aufgelöst, dafür überall lauffähig.
export const CPU_MAX_WIDTH = 480;
const BYTE_MAX = 255;
const CHANNELS = 4;

function context2d(canvas: HTMLCanvasElement, willReadFrequently: boolean) {
  const context = canvas.getContext('2d', { willReadFrequently });
  if (context === null) {
    throw new Error(
      'Weder WebGL2 noch ein 2D-Zeichenkontext sind verfügbar, die Vorschau ist nicht möglich.',
    );
  }
  return context;
}

function toByte(value: number): number {
  return Math.round(Math.min(Math.max(value, 0), 1) * BYTE_MAX);
}

// Gleiche Wirkung wie der Shader (LUT, Stärke, Trennlinie), Pixel für Pixel auf der CPU gerechnet.
export function createCpuRenderer(canvas: HTMLCanvasElement): LutRenderer {
  const output = context2d(canvas, false);
  const scratchCanvas = document.createElement('canvas');
  const scratch = context2d(scratchCanvas, true);
  let lut: Lut | null = null;

  return {
    kind: 'cpu',

    outputSize(source: { width: number; height: number }): { width: number; height: number } {
      const scale = Math.min(1, CPU_MAX_WIDTH / source.width);
      return {
        width: Math.max(1, Math.round(source.width * scale)),
        height: Math.max(1, Math.round(source.height * scale)),
      };
    },

    setLut(next: Lut): void {
      lut = next;
    },

    render(source: RenderSource, options): void {
      const { width, height } = canvas;
      scratchCanvas.width = width;
      scratchCanvas.height = height;
      scratch.drawImage(source, 0, 0, width, height);
      const image = scratch.getImageData(0, 0, width, height);
      const pixels = image.data;
      if (lut !== null) {
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            // Wie im Shader: links der Trennlinie bleibt das Original stehen.
            if ((x + 0.5) / width < options.split) {
              continue;
            }
            const offset = (y * width + x) * CHANNELS;
            const r = Number(pixels[offset]) / BYTE_MAX;
            const g = Number(pixels[offset + 1]) / BYTE_MAX;
            const b = Number(pixels[offset + 2]) / BYTE_MAX;
            const [cr, cg, cb] = sampleLut(lut, [r, g, b]);
            pixels[offset] = toByte(cr);
            pixels[offset + 1] = toByte(cg);
            pixels[offset + 2] = toByte(cb);
          }
        }
      }
      output.putImageData(image, 0, 0);
    },

    dispose(): void {
      lut = null;
    },
  };
}
