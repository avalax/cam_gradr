import { describe, expect, it, vi } from 'vitest';

import { attachStream, captureFromVideo } from './video-bindings';

function fakeVideo() {
  const play = vi.fn(() => Promise.resolve());
  const video = { srcObject: null, play } as unknown as HTMLVideoElement;
  return { video, play };
}

describe('attachStream', () => {
  it('ignoriert eine abgebrochene Wiedergabe, etwa wenn das Element entfernt wird', async () => {
    const { video, play } = fakeVideo();
    play.mockReturnValueOnce(Promise.reject(new DOMException('abgebrochen', 'AbortError')));
    attachStream(video, {} as MediaStream);
    await Promise.resolve();
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('setzt den Stream und startet die Wiedergabe', () => {
    const { video, play } = fakeVideo();
    const stream = {} as MediaStream;
    attachStream(video, stream);
    expect(video.srcObject).toBe(stream);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('löst den Stream ohne Wiedergabe', () => {
    const { video, play } = fakeVideo();
    attachStream(video, null);
    expect(video.srcObject).toBeNull();
    expect(play).not.toHaveBeenCalled();
  });

  it('ignoriert ein fehlendes Video-Element', () => {
    expect(() => {
      attachStream(null, {} as MediaStream);
    }).not.toThrow();
  });
});

describe('captureFromVideo', () => {
  it('übergibt einen Frame-Grabber an die Aufnahmefunktion', () => {
    const capture = vi.fn(() => Promise.resolve());
    captureFromVideo(fakeVideo().video, capture);
    expect(capture).toHaveBeenCalledTimes(1);
    const calls = capture.mock.calls as unknown as [[{ grab: unknown; nextFrame: unknown }]];
    expect(typeof calls[0][0].grab).toBe('function');
    expect(typeof calls[0][0].nextFrame).toBe('function');
  });

  it('macht ohne Video-Element nichts', () => {
    const capture = vi.fn(() => Promise.resolve());
    captureFromVideo(null, capture);
    expect(capture).not.toHaveBeenCalled();
  });
});
