import { describe, expect, it, vi } from 'vitest';

import { attachStream, captureFromVideo, grabVideoFrame } from './video-bindings';

function fakeVideo() {
  const play = vi.fn(() => Promise.resolve());
  const video = { srcObject: null, play } as unknown as HTMLVideoElement;
  return { video, play };
}

describe('attachStream', () => {
  it('ignores an aborted playback, e.g. when the element is removed', async () => {
    const { video, play } = fakeVideo();
    play.mockReturnValueOnce(Promise.reject(new DOMException('abgebrochen', 'AbortError')));
    attachStream(video, {} as MediaStream);
    await Promise.resolve();
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('sets the stream and starts playback', () => {
    const { video, play } = fakeVideo();
    const stream = {} as MediaStream;
    attachStream(video, stream);
    expect(video.srcObject).toBe(stream);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('detaches the stream without playback', () => {
    const { video, play } = fakeVideo();
    attachStream(video, null);
    expect(video.srcObject).toBeNull();
    expect(play).not.toHaveBeenCalled();
  });

  it('ignores a missing video element', () => {
    expect(() => {
      attachStream(null, {} as MediaStream);
    }).not.toThrow();
  });
});

describe('captureFromVideo', () => {
  it('passes a frame grabber to the capture function', async () => {
    const capture = vi.fn(() => Promise.resolve());
    await captureFromVideo(fakeVideo().video, capture);
    expect(capture).toHaveBeenCalledTimes(1);
    const calls = capture.mock.calls as unknown as [[{ grab: unknown; nextFrame: unknown }]];
    expect(typeof calls[0][0].grab).toBe('function');
    expect(typeof calls[0][0].nextFrame).toBe('function');
  });

  it('does nothing without a video element', async () => {
    const capture = vi.fn(() => Promise.resolve());
    await captureFromVideo(null, capture);
    expect(capture).not.toHaveBeenCalled();
  });
});

describe('grabVideoFrame', () => {
  it('returns nothing without a video element or while the video has no image yet', () => {
    expect(grabVideoFrame(null)).toBeNull();
    expect(grabVideoFrame({ videoWidth: 0 } as HTMLVideoElement)).toBeNull();
  });

  it('reads the current image as a frame with values from 0 to 1', () => {
    const context = {
      drawImage: vi.fn(),
      getImageData: () => ({ width: 1, height: 1, data: new Uint8ClampedArray([255, 0, 51, 255]) }),
    };
    vi.spyOn(document, 'createElement').mockReturnValue({
      width: 0,
      height: 0,
      getContext: () => context,
    } as unknown as HTMLCanvasElement);
    const frame = grabVideoFrame({ videoWidth: 1, videoHeight: 1 } as HTMLVideoElement);
    vi.restoreAllMocks();
    expect([...(frame?.data ?? [])]).toEqual([1, 0, expect.closeTo(0.2, 5)]);
  });
});
