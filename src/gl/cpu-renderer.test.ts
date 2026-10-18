import { afterEach, describe, expect, it, vi } from 'vitest';

import { identityLut } from '../lut/lut';
import type { Lut } from '../lut/lut';

import { CPU_MAX_WIDTH, createCpuRenderer } from './cpu-renderer';

// Zwei Pixel: ein dunkles und ein helles Grau; der Test-LUT kehrt alle Werte um.
const INPUT = [51, 51, 51, 255, 204, 204, 204, 255];

function invertedLut(): Lut {
  const lut = identityLut(2);
  return { size: 2, data: lut.data.map((value) => 1 - value) };
}

function setup(options: { canvasContext?: boolean; scratchContext?: boolean } = {}) {
  const { canvasContext = true, scratchContext = true } = options;
  const image = { data: new Uint8ClampedArray(INPUT) };
  const scratch = {
    drawImage: vi.fn(),
    getImageData: vi.fn(() => image),
  };
  const output = { putImageData: vi.fn() };
  const canvas = { width: 2, height: 1 } as unknown as HTMLCanvasElement;
  const scratchCanvas = { width: 0, height: 0 } as unknown as HTMLCanvasElement;
  Object.assign(canvas, { getContext: vi.fn(() => (canvasContext ? output : null)) });
  Object.assign(scratchCanvas, { getContext: vi.fn(() => (scratchContext ? scratch : null)) });
  vi.spyOn(document, 'createElement').mockReturnValue(scratchCanvas);
  return { canvas, scratchCanvas, scratch, output, image };
}

describe('createCpuRenderer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('beschreibt sich als Software-Renderer', () => {
    const { canvas } = setup();
    expect(createCpuRenderer(canvas).kind).toBe('cpu');
  });

  it('rechnet große Bilder auf die Maximalbreite herunter und behält das Seitenverhältnis', () => {
    const { canvas } = setup();
    const renderer = createCpuRenderer(canvas);
    expect(renderer.outputSize({ width: 1280, height: 720 })).toEqual({
      width: CPU_MAX_WIDTH,
      height: 270,
    });
  });

  it('vergrößert kleine Bilder nicht und liefert mindestens einen Pixel', () => {
    const { canvas } = setup();
    const renderer = createCpuRenderer(canvas);
    expect(renderer.outputSize({ width: 8, height: 4 })).toEqual({ width: 8, height: 4 });
    expect(renderer.outputSize({ width: 2000, height: 1 })).toEqual({
      width: CPU_MAX_WIDTH,
      height: 1,
    });
  });

  it('wendet LUT und volle Stärke auf alle Pixel an', () => {
    const { canvas, scratch, scratchCanvas, output, image } = setup();
    const renderer = createCpuRenderer(canvas);
    renderer.setLut(invertedLut());
    const source = {} as HTMLVideoElement;
    renderer.render(source, { split: 0 });
    expect(scratchCanvas.width).toBe(2);
    expect(scratchCanvas.height).toBe(1);
    expect(scratch.drawImage).toHaveBeenCalledWith(source, 0, 0, 2, 1);
    expect([...image.data]).toEqual([204, 204, 204, 255, 51, 51, 51, 255]);
    expect(output.putImageData).toHaveBeenCalledWith(image, 0, 0);
  });

  it('lässt links der Trennlinie das Original stehen', () => {
    const { canvas, image } = setup();
    const renderer = createCpuRenderer(canvas);
    renderer.setLut(invertedLut());
    renderer.render({} as HTMLVideoElement, { split: 0.5 });
    expect([...image.data]).toEqual([51, 51, 51, 255, 51, 51, 51, 255]);
  });

  it('zeichnet das Bild unverändert, solange keine LUT gesetzt ist', () => {
    const { canvas, image, output } = setup();
    createCpuRenderer(canvas).render({} as HTMLVideoElement, { split: 0 });
    expect([...image.data]).toEqual(INPUT);
    expect(output.putImageData).toHaveBeenCalledTimes(1);
  });

  it('vergisst die LUT beim Aufräumen', () => {
    const { canvas, image } = setup();
    const renderer = createCpuRenderer(canvas);
    renderer.setLut(invertedLut());
    renderer.dispose();
    renderer.render({} as HTMLVideoElement, { split: 0 });
    expect([...image.data]).toEqual(INPUT);
  });

  it('meldet einen fehlenden 2D-Kontext der Zeichenfläche oder der Arbeitsfläche', () => {
    expect(() => createCpuRenderer(setup({ canvasContext: false }).canvas)).toThrow(
      'Weder WebGL2 noch ein 2D-Zeichenkontext',
    );
    expect(() => createCpuRenderer(setup({ scratchContext: false }).canvas)).toThrow(
      'Weder WebGL2 noch ein 2D-Zeichenkontext',
    );
  });
});
