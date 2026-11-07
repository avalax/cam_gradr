import { MAX_CODE, toByte } from '../color/srgb';
import { sampleLut } from '../lut/lut';
import type { Lut } from '../lut/lut';
import { t } from '../lang';

import type { LutRenderer, RenderSource } from './lut-renderer';

// Software rendering on the CPU for browsers without WebGL2: lower resolution, runs anywhere.
export const CPU_MAX_WIDTH = 480;
// The pixels of a canvas are RGBA.
const CHANNELS = 4;

function context2d(canvas: HTMLCanvasElement, willReadFrequently: boolean) {
  const context = canvas.getContext('2d', { willReadFrequently });
  if (context === null) {
    throw new Error(t('preview.errors.noContext'));
  }
  return context;
}

// Same effect as the shader (the LUT, and left of the split line the original or the left LUT),
// computed pixel by pixel on the CPU.
export function createCpuRenderer(canvas: HTMLCanvasElement): LutRenderer {
  const output = context2d(canvas, false);
  const scratchCanvas = document.createElement('canvas');
  const scratch = context2d(scratchCanvas, true);
  let lut: Lut | null = null;
  let leftLut: Lut | null = null;

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

    setLeftLut(next: Lut | null): void {
      leftLut = next;
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
            // As in the shader: left of the split line the original stays, or the left LUT
            // applies.
            const applied = (x + 0.5) / width < options.split ? leftLut : lut;
            if (applied === null) {
              continue;
            }
            const offset = (y * width + x) * CHANNELS;
            const r = Number(pixels[offset]) / MAX_CODE;
            const g = Number(pixels[offset + 1]) / MAX_CODE;
            const b = Number(pixels[offset + 2]) / MAX_CODE;
            const [cr, cg, cb] = sampleLut(applied, [r, g, b]);
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
      leftLut = null;
    },
  };
}
