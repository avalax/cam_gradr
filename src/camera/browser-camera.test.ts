import { describe, expect, it, vi } from 'vitest';

import { createBrowserCamera } from './browser-camera';
import type { MediaApi } from './browser-camera';

function fakeStream(settings: MediaTrackSettings | null) {
  const stop = vi.fn();
  const stream = {
    getVideoTracks: () => (settings === null ? [] : [{ getSettings: () => settings }]),
    getTracks: () => [{ stop }, { stop }],
  } as unknown as MediaStream;
  return { stream, stop };
}

function fakeMedia(overrides: Partial<MediaApi> = {}): MediaApi {
  return {
    enumerateDevices: () => Promise.resolve([]),
    getUserMedia: () => Promise.resolve(fakeStream({}).stream),
    ...overrides,
  };
}

describe('createBrowserCamera', () => {
  it('lists only video inputs and assigns fallback names', async () => {
    const camera = createBrowserCamera(() =>
      fakeMedia({
        enumerateDevices: () =>
          Promise.resolve([
            { kind: 'audioinput', deviceId: 'a', label: 'Mikro' },
            { kind: 'videoinput', deviceId: 'v1', label: 'Webcam' },
            { kind: 'videoinput', deviceId: 'v2', label: '' },
          ] as MediaDeviceInfo[]),
      }),
    );
    expect(await camera.enumerate()).toEqual([
      { id: 'v1', label: 'Webcam' },
      { id: 'v2', label: 'Kamera 2' },
    ]);
  });

  it('reports a missing media API as unsupported', async () => {
    const camera = createBrowserCamera(vi.fn<() => MediaApi | undefined>());
    await expect(camera.enumerate()).rejects.toMatchObject({ code: 'unsupported' });
    await expect(camera.open(null, { width: 1, height: 1 })).rejects.toMatchObject({
      code: 'unsupported',
    });
  });

  it('converts errors while listing', async () => {
    const camera = createBrowserCamera(() =>
      fakeMedia({ enumerateDevices: () => Promise.reject(new Error('x')) }),
    );
    await expect(camera.enumerate()).rejects.toMatchObject({ code: 'unknown' });
  });

  it('opens without a device at ideal resolution and reads the actual values', async () => {
    const getUserMedia = vi.fn(() =>
      Promise.resolve(fakeStream({ width: 1280, height: 720, deviceId: 'dev' }).stream),
    );
    const camera = createBrowserCamera(() => fakeMedia({ getUserMedia }));
    const session = await camera.open(null, { width: 1920, height: 1080 });
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: false,
      video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
    });
    expect(session.settings).toEqual({ width: 1280, height: 720, deviceId: 'dev' });
  });

  it('requires a specific device exactly and uses fallback values without settings', async () => {
    const getUserMedia = vi.fn(() => Promise.resolve(fakeStream({}).stream));
    const camera = createBrowserCamera(() => fakeMedia({ getUserMedia }));
    const session = await camera.open('abc', { width: 640, height: 480 });
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: false,
      video: { deviceId: { exact: 'abc' }, width: { ideal: 640 }, height: { ideal: 480 } },
    });
    expect(session.settings).toEqual({ width: 640, height: 480, deviceId: 'abc' });
  });

  it('uses an empty device ID when neither track nor device provides one', async () => {
    const camera = createBrowserCamera(() =>
      fakeMedia({ getUserMedia: () => Promise.resolve(fakeStream(null).stream) }),
    );
    const session = await camera.open(null, { width: 640, height: 480 });
    expect(session.settings.deviceId).toBe('');
  });

  it('converts errors while opening', async () => {
    const error = new DOMException('x', 'NotAllowedError');
    const camera = createBrowserCamera(() =>
      fakeMedia({ getUserMedia: () => Promise.reject(error) }),
    );
    await expect(camera.open(null, { width: 1, height: 1 })).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('stops all tracks on close', () => {
    const { stream, stop } = fakeStream({});
    createBrowserCamera(() => fakeMedia()).close({
      stream,
      settings: { width: 1, height: 1, deviceId: '' },
    });
    expect(stop).toHaveBeenCalledTimes(2);
  });
});
