import { afterEach, describe, expect, it, vi } from 'vitest';

import { createVideoGrabber } from './video-grabber';
import type { CanvasLike } from './video-grabber';

function fakeVideo(extra: Record<string, unknown> = {}): HTMLVideoElement {
  return { videoWidth: 4, videoHeight: 2, ...extra } as unknown as HTMLVideoElement;
}

describe('createVideoGrabber.grab', () => {
  it('zeichnet das Video auf ein Canvas in Videogröße und liest die Pixel', () => {
    const drawImage = vi.fn();
    const getImageData = vi.fn(() => ({ width: 4, height: 2, data: [] }));
    const canvas: CanvasLike = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage, getImageData }),
    };
    const video = fakeVideo();
    const frame = createVideoGrabber(video, () => canvas).grab();
    expect(canvas.width).toBe(4);
    expect(canvas.height).toBe(2);
    expect(drawImage).toHaveBeenCalledWith(video, 0, 0);
    expect(getImageData).toHaveBeenCalledWith(0, 0, 4, 2);
    expect(frame.width).toBe(4);
  });

  it('wirft, wenn kein 2D-Kontext verfügbar ist', () => {
    const canvas: CanvasLike = { width: 0, height: 0, getContext: () => null };
    expect(() => createVideoGrabber(fakeVideo(), () => canvas).grab()).toThrow('Canvas-Kontext');
  });
});

describe('createVideoGrabber.nextFrame', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('nutzt requestVideoFrameCallback, wenn vorhanden', async () => {
    const requestVideoFrameCallback = vi.fn((callback: () => void) => {
      callback();
      return 1;
    });
    const grabber = createVideoGrabber(fakeVideo({ requestVideoFrameCallback }), () => {
      throw new Error('nicht benötigt');
    });
    await grabber.nextFrame();
    expect(requestVideoFrameCallback).toHaveBeenCalledTimes(1);
  });

  it('fällt auf einen Timer zurück', async () => {
    vi.useFakeTimers();
    const grabber = createVideoGrabber(fakeVideo(), () => {
      throw new Error('nicht benötigt');
    });
    const pending = grabber.nextFrame();
    await vi.advanceTimersByTimeAsync(40);
    await expect(pending).resolves.toBeUndefined();
  });
});
