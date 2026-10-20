import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CameraError } from './camera-error';
import { setCameraApi, useCameraStore } from './camera-store';
import { RESOLUTIONS } from './types';
import type { CameraApi, CameraSession } from './types';

function session(deviceId = 'cam1'): CameraSession {
  return {
    stream: { id: 'stream' } as unknown as MediaStream,
    settings: { width: 1280, height: 720, deviceId },
  };
}

function fakeApi(overrides: Partial<CameraApi> = {}) {
  const api = {
    enumerate: vi.fn(() => Promise.resolve([{ id: 'cam1', label: 'Webcam' }])),
    open: vi.fn(() => Promise.resolve(session())),
    close: vi.fn(),
    ...overrides,
  } satisfies CameraApi;
  setCameraApi(api);
  return api;
}

// Red component of the shown still image.
function shown(store: ReturnType<typeof useCameraStore>): number | undefined {
  return store.still?.data[0];
}

describe('useCameraStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('starts the camera and adopts device, resolution and device list', async () => {
    const api = fakeApi();
    const store = useCameraStore();
    await store.start();
    expect(store.status).toBe('live');
    expect(store.actual).toEqual({ width: 1280, height: 720 });
    expect(store.selectedDeviceId).toBe('cam1');
    expect(store.devices).toEqual([{ id: 'cam1', label: 'Webcam' }]);
    expect(api.open).toHaveBeenCalledWith(null, { width: 1280, height: 720 });
  });

  it('leaves the device selection empty when the camera reports no ID', async () => {
    fakeApi({ open: () => Promise.resolve(session('')) });
    const store = useCameraStore();
    await store.start();
    expect(store.selectedDeviceId).toBeNull();
  });

  it('reports errors and releases the camera', async () => {
    const api = fakeApi({
      open: vi.fn().mockRejectedValue(new CameraError('permission-denied')),
    });
    const store = useCameraStore();
    await store.start();
    expect(store.status).toBe('error');
    expect(store.errorMessage).toContain('verweigert');
    expect(store.stream).toBeNull();
    expect(api.close).not.toHaveBeenCalled();
  });

  it('releases the session when listing fails after opening', async () => {
    const api = fakeApi({ enumerate: () => Promise.reject(new CameraError('unknown')) });
    const store = useCameraStore();
    await store.start();
    expect(store.status).toBe('error');
    expect(api.close).toHaveBeenCalledTimes(1);
  });

  it('stops the camera', async () => {
    const api = fakeApi();
    const store = useCameraStore();
    await store.start();
    store.stop();
    expect(store.status).toBe('idle');
    expect(store.stream).toBeNull();
    expect(store.actual).toBeNull();
    expect(api.close).toHaveBeenCalledTimes(1);
    store.stop();
    expect(api.close).toHaveBeenCalledTimes(1);
  });

  it('restarts the running session on a repeated start', async () => {
    const api = fakeApi();
    const store = useCameraStore();
    await store.start();
    await store.start();
    expect(api.close).toHaveBeenCalledTimes(1);
    expect(api.open).toHaveBeenCalledTimes(2);
  });

  it('switches the device immediately only in live mode', async () => {
    const api = fakeApi();
    const store = useCameraStore();
    await store.selectDevice('cam2');
    expect(store.selectedDeviceId).toBe('cam2');
    expect(api.open).not.toHaveBeenCalled();
    await store.start();
    await store.selectDevice('cam1');
    expect(api.open).toHaveBeenLastCalledWith('cam1', { width: 1280, height: 720 });
  });

  it('switches the resolution immediately only in live mode', async () => {
    const api = fakeApi();
    const store = useCameraStore();
    const full = RESOLUTIONS[2];
    if (full === undefined) {
      throw new Error('resolution missing');
    }
    await store.selectResolution(full);
    expect(store.resolution).toEqual(full);
    expect(api.open).not.toHaveBeenCalled();
    await store.start();
    await store.selectResolution({ width: 640, height: 480 });
    expect(api.open).toHaveBeenLastCalledWith('cam1', { width: 640, height: 480 });
  });

  it('captures an averaged still image', async () => {
    fakeApi();
    const store = useCameraStore();
    const grab = vi.fn(() => ({ width: 1, height: 1, data: [255, 255, 255, 255] }));
    await store.captureStill({ grab, nextFrame: () => Promise.resolve() }, 2);
    expect(store.still?.width).toBe(1);
    expect(grab).toHaveBeenCalledTimes(2);
    expect(store.errorMessage).toBeNull();
  });

  it('reports errors during capture', async () => {
    fakeApi();
    const store = useCameraStore();
    const failing = {
      grab: () => {
        throw new Error('Canvas kaputt');
      },
      nextFrame: () => Promise.resolve(),
    };
    await store.captureStill(failing, 1);
    expect(store.errorMessage).toBe('Canvas kaputt');
    expect(store.still).toBeNull();
  });

  it('uses a default message for non-Error failures', async () => {
    fakeApi();
    const store = useCameraStore();
    const failing = {
      grab: () => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'kaputt';
      },
      nextFrame: () => Promise.resolve(),
    };
    await store.captureStill(failing, 1);
    expect(store.errorMessage).toBe('Aufnahme fehlgeschlagen.');
  });

  it('discards the still image on clearing and on every camera start', async () => {
    fakeApi();
    const store = useCameraStore();
    const grabber = {
      grab: () => ({ width: 1, height: 1, data: [0, 0, 0, 0] }),
      nextFrame: () => Promise.resolve(),
    };
    await store.captureStill(grabber, 1);
    store.clearStill();
    expect(store.still).toBeNull();
    await store.captureStill(grabber, 1);
    await store.start();
    expect(store.still).toBeNull();
  });

  it('stores the still image when switching steps and restores the image of the other step', async () => {
    fakeApi();
    const store = useCameraStore();
    const grabber = {
      grab: () => ({ width: 1, height: 1, data: [0, 0, 0, 0] }),
      nextFrame: () => Promise.resolve(),
    };
    await store.captureStill(grabber, 1);
    const gray = store.still;
    store.swapStill('gray', 'color');
    expect(store.still).toBeNull();
    await store.captureStill(grabber, 1);
    const color = store.still;
    expect(color).not.toBe(gray);
    store.swapStill('color', 'gray');
    expect(store.still).toBe(gray);
    store.swapStill('gray', 'color');
    expect(store.still).toBe(color);
    // Camera start and clearing only affect the shown still image; the parked image is kept.
    await store.start();
    expect(store.still).toBeNull();
    store.stop();
    expect(store.still).toBe(color);
    store.swapStill('color', 'gray');
    expect(store.still).toBe(gray);
    store.clearStill();
    store.swapStill('gray', 'color');
    expect(store.still).toBe(color);
    store.swapStill('color', 'gray');
    expect(store.still).toBeNull();
    // Without a still image in the tab being left, nothing is parked; discarding clears all.
    store.swapStill('color', 'gray');
    await store.captureStill(grabber, 1);
    store.discardStills();
    store.swapStill('gray', 'color');
    expect(store.still).toBeNull();
  });

  describe('search with held still image', () => {
    const frame = (value: number) => ({
      width: 1,
      height: 1,
      data: new Float32Array([value, 0, 0]),
    });
    const grabber = {
      grab: () => ({ width: 1, height: 1, data: [255, 0, 0, 255] }),
      nextFrame: () => Promise.resolve(),
    };

    it('holds the previous still image on camera start and returns it on stop', async () => {
      fakeApi();
      const store = useCameraStore();
      const old = frame(0.2);
      store.still = old;
      await store.start();
      expect(store.still).toBeNull();
      expect(store.allStills().gray).toBe(old);
      store.stop();
      expect(store.still).toBe(old);
      expect(store.allStills().gray).toBe(old);
    });

    it('keeps a new still image and drops the previous one', async () => {
      fakeApi();
      const store = useCameraStore();
      const old = frame(0.2);
      store.still = old;
      await store.start();
      await store.captureStill(grabber, 1);
      const fresh = store.still;
      expect(fresh).not.toBeNull();
      store.stop();
      expect(store.still).toBe(fresh);
      expect(store.still).not.toBe(old);
    });

    it('returns the previous still image even after a start error', async () => {
      fakeApi({ open: vi.fn().mockRejectedValue(new CameraError('permission-denied')) });
      const store = useCameraStore();
      const old = frame(0.2);
      store.still = old;
      await store.start();
      expect(store.status).toBe('error');
      expect(store.still).toBe(old);
    });

    it('also deletes the held still image with clearStill and discardStills', async () => {
      fakeApi();
      const store = useCameraStore();
      store.still = frame(0.2);
      await store.start();
      store.clearStill();
      store.stop();
      expect(store.still).toBeNull();
      store.still = frame(0.3);
      await store.start();
      store.discardStills();
      store.stop();
      expect(store.still).toBeNull();
    });

    it('stores the still image on tab switch with a running camera and holds the image of the new tab', async () => {
      fakeApi();
      const store = useCameraStore();
      const grayStill = frame(0.1);
      store.still = grayStill;
      store.swapStill('gray', 'color');
      const colorStill = frame(0.2);
      store.still = colorStill;
      store.swapStill('color', 'gray');
      await store.start();
      expect(store.still).toBeNull();
      store.swapStill('gray', 'color');
      expect(store.still).toBeNull();
      expect(store.allStills().gray).toBe(grayStill);
      expect(store.allStills().color).toBe(colorStill);
      store.stop();
      expect(store.still).toBe(colorStill);
      store.swapStill('color', 'gray');
      expect(store.still).toBe(grayStill);
    });
  });

  it('knows the owner of the still image, returns all still images and restores them', () => {
    fakeApi();
    const store = useCameraStore();
    const frame = (value: number) => ({
      width: 1,
      height: 1,
      data: new Float32Array([value, 0, 0]),
    });
    expect(store.stillOwner).toBe('gray');
    expect(store.allStills()).toEqual({});

    store.still = frame(0.1);
    store.swapStill('gray', 'color');
    expect(store.stillOwner).toBe('color');
    store.still = frame(0.2);
    const stills = store.allStills();
    expect(Object.keys(stills)).toHaveLength(2);
    expect(stills.color?.data[0]).toBeCloseTo(0.2);
    expect(stills.gray?.data[0]).toBeCloseTo(0.1);

    store.discardStills();
    expect(store.allStills()).toEqual({});
    store.restoreStills({ gray: frame(0.3), color: frame(0.4), preview: frame(0.5) });
    // The owner's image (color charts) is shown, the others are parked.
    expect(shown(store)).toBeCloseTo(0.4);
    store.swapStill('color', 'preview');
    expect(shown(store)).toBeCloseTo(0.5);
    store.restoreStills({});
    expect(store.still).toBeNull();
  });

  it('uses the default number of frames', async () => {
    fakeApi();
    const store = useCameraStore();
    const grab = vi.fn(() => ({ width: 1, height: 1, data: [0, 0, 0, 0] }));
    await store.captureStill({ grab, nextFrame: () => Promise.resolve() });
    expect(grab).toHaveBeenCalledTimes(8);
  });
});
