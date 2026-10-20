import { describe, expect, it, vi } from 'vitest';

import { drawFrame } from './draw-frame';

describe('drawFrame', () => {
  it('writes RGB values as 8-bit pixels with full alpha channel', () => {
    const image = { data: new Uint8ClampedArray(8) } as ImageData;
    const putImageData = vi.fn();
    const createImageData = vi.fn(() => image);
    drawFrame(
      { createImageData, putImageData },
      { width: 2, height: 1, data: new Float32Array([1, 0, 0.5, 0, 1, 0]) },
    );
    expect(createImageData).toHaveBeenCalledWith(2, 1);
    expect([...image.data]).toEqual([255, 0, 128, 255, 0, 255, 0, 255]);
    expect(putImageData).toHaveBeenCalledWith(image, 0, 0);
  });

  it('uses 0 for missing data', () => {
    const image = { data: new Uint8ClampedArray(4).fill(9) } as ImageData;
    drawFrame(
      { createImageData: () => image, putImageData: vi.fn() },
      { width: 1, height: 1, data: new Float32Array(0) },
    );
    expect([...image.data]).toEqual([0, 0, 0, 255]);
  });
});
