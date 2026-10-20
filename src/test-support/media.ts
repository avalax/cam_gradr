import { vi } from 'vitest';

import { setCameraApi } from '../camera/camera-store';
import type { CameraApi } from '../camera/types';

export const FAKE_STREAM = { id: 'stream' } as unknown as MediaStream;

// Replaces the camera API with a stand-in (1280x720, two devices).
export function installFakeCamera(overrides: Partial<CameraApi> = {}) {
  const api = {
    enumerate: vi.fn(() =>
      Promise.resolve([
        { id: 'cam1', label: 'Webcam 1' },
        { id: 'cam2', label: 'Webcam 2' },
      ]),
    ),
    open: vi.fn((deviceId: string | null) =>
      Promise.resolve({
        stream: FAKE_STREAM,
        settings: { width: 1280, height: 720, deviceId: deviceId ?? 'cam1' },
      }),
    ),
    close: vi.fn(),
    ...overrides,
  } satisfies CameraApi;
  setCameraApi(api);
  return api;
}

// happy-dom accepts only real MediaStreams and plays no video; stand-ins are enough here.
export function installMediaStubs() {
  const play = vi.fn(() => Promise.resolve());
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { value: play, configurable: true });
  const sources = new WeakMap<object, unknown>();
  Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', {
    configurable: true,
    get(this: object) {
      return sources.get(this) ?? null;
    },
    set(this: object, value: unknown) {
      sources.set(this, value);
    },
  });
  return { play };
}
