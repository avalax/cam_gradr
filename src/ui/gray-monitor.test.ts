import { describe, expect, it, vi } from 'vitest';

import { frameGrid, measureTick } from './gray-monitor';

function videoWithCanvas() {
  const getImageData = vi.fn(() => ({ width: 2, height: 1, data: [1, 2, 3, 255, 4, 5, 6, 255] }));
  const context = { drawImage: vi.fn(), getImageData };
  vi.spyOn(document, 'createElement').mockReturnValue({
    width: 0,
    height: 0,
    getContext: () => context,
  } as unknown as HTMLCanvasElement);
  return { videoWidth: 2, videoHeight: 1 } as HTMLVideoElement;
}

describe('frameGrid', () => {
  it('beschreibt einen gemittelten RGB-Frame als Pixelraster', () => {
    const data = new Float32Array([0.1, 0.2, 0.3]);
    expect(frameGrid({ width: 1, height: 1, data })).toEqual({
      width: 1,
      height: 1,
      data,
      channels: 3,
      maxValue: 1,
    });
  });
});

describe('measureTick', () => {
  it('liest einen Frame und übergibt ihn als RGBA-Raster', () => {
    const video = videoWithCanvas();
    const measure = vi.fn();
    measureTick(true, video, measure);
    expect(measure).toHaveBeenCalledWith({
      width: 2,
      height: 1,
      data: [1, 2, 3, 255, 4, 5, 6, 255],
      channels: 4,
      maxValue: 255,
    });
  });

  it('tut nichts, wenn nicht aktiv oder ohne Video', () => {
    const measure = vi.fn();
    measureTick(false, videoWithCanvas(), measure);
    measureTick(true, null, measure);
    expect(measure).not.toHaveBeenCalled();
  });
});
