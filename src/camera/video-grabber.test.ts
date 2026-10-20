import { afterEach, describe, expect, it, vi } from 'vitest';

import { setLocale } from '../lang';

import { createVideoGrabber } from './video-grabber';
import type { CanvasLike } from './video-grabber';

function fakeVideo(extra: Record<string, unknown> = {}): HTMLVideoElement {
  return { videoWidth: 4, videoHeight: 2, ...extra } as unknown as HTMLVideoElement;
}

describe('createVideoGrabber.grab', () => {
  it('draws the video onto a canvas at video size and reads the pixels', () => {
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

  it('throws as long as the video has no size yet', () => {
    const canvas: CanvasLike = { width: 0, height: 0, getContext: () => null };
    for (const size of [{ videoWidth: 0 }, { videoHeight: 0 }]) {
      expect(() => createVideoGrabber(fakeVideo(size), () => canvas).grab()).toThrow(
        'noch nicht bereit',
      );
    }
  });

  it('throws when no 2D context is available', () => {
    const canvas: CanvasLike = { width: 0, height: 0, getContext: () => null };
    expect(() => createVideoGrabber(fakeVideo(), () => canvas).grab()).toThrow('Canvas-Kontext');
  });
});

describe('createVideoGrabber.grab in English', () => {
  it('reports the errors in the selected language', () => {
    setLocale('en');
    const canvas: CanvasLike = { width: 0, height: 0, getContext: () => null };
    expect(() => createVideoGrabber(fakeVideo({ videoWidth: 0 }), () => canvas).grab()).toThrow(
      'not ready yet',
    );
    expect(() => createVideoGrabber(fakeVideo(), () => canvas).grab()).toThrow(
      'Canvas context not available',
    );
  });
});

describe('createVideoGrabber.nextFrame', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses requestVideoFrameCallback when available', async () => {
    const requestVideoFrameCallback = vi.fn((callback: () => void) => {
      callback();
      return 1;
    });
    const grabber = createVideoGrabber(fakeVideo({ requestVideoFrameCallback }), () => {
      throw new Error('not needed');
    });
    await grabber.nextFrame();
    expect(requestVideoFrameCallback).toHaveBeenCalledTimes(1);
  });

  it('continues after a short time even without a reported video frame', async () => {
    vi.useFakeTimers();
    const requestVideoFrameCallback = vi.fn(() => 1);
    const grabber = createVideoGrabber(fakeVideo({ requestVideoFrameCallback }), () => {
      throw new Error('not needed');
    });
    const pending = grabber.nextFrame();
    await vi.advanceTimersByTimeAsync(150);
    await expect(pending).resolves.toBeUndefined();
    expect(requestVideoFrameCallback).toHaveBeenCalledTimes(1);
  });

  it('falls back to a timer', async () => {
    vi.useFakeTimers();
    const grabber = createVideoGrabber(fakeVideo(), () => {
      throw new Error('not needed');
    });
    const pending = grabber.nextFrame();
    await vi.advanceTimersByTimeAsync(150);
    await expect(pending).resolves.toBeUndefined();
  });
});
