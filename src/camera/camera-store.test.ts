import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { i18n } from '../lang';
import { grayFrame } from '../test-support/frames';
import { FAKE_STREAM, installFakeCamera } from '../test-support/media';

import { CameraError } from './camera-error';
import { useCameraStore } from './camera-store';
import { RESOLUTIONS } from './types';

// Red component of the shown still image.
function shown(store: ReturnType<typeof useCameraStore>): number | undefined {
  return store.still?.data[0];
}

describe('useCameraStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('starts the camera and adopts device, resolution and device list', async () => {
    const api = installFakeCamera();
    const store = useCameraStore();
    await store.start();
    expect(store.status).toBe('live');
    expect(store.actual).toEqual({ width: 1280, height: 720 });
    expect(store.selectedDeviceId).toBe('cam1');
    expect(store.devices.map((device) => device.id)).toEqual(['cam1', 'cam2']);
    expect(api.open).toHaveBeenCalledWith(null, { width: 1280, height: 720 });
  });

  it('leaves the device selection empty when the camera reports no ID', async () => {
    installFakeCamera({
      open: () =>
        Promise.resolve({
          stream: FAKE_STREAM,
          settings: { width: 1280, height: 720, deviceId: '' },
        }),
    });
    const store = useCameraStore();
    await store.start();
    expect(store.selectedDeviceId).toBeNull();
  });

  it('reports errors and releases the camera', async () => {
    const api = installFakeCamera({
      open: vi.fn().mockRejectedValue(new CameraError('permissionDenied')),
    });
    const store = useCameraStore();
    await store.start();
    expect(store.status).toBe('error');
    expect(store.errorMessage).toContain('verweigert');
    expect(store.stream).toBeNull();
    expect(api.close).not.toHaveBeenCalled();
  });

  it('releases the session when listing fails after opening', async () => {
    const api = installFakeCamera({ enumerate: () => Promise.reject(new CameraError('unknown')) });
    const store = useCameraStore();
    await store.start();
    expect(store.status).toBe('error');
    expect(api.close).toHaveBeenCalledTimes(1);
  });

  it('stops the camera', async () => {
    const api = installFakeCamera();
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

  it('leaves no error behind when it is switched off', async () => {
    installFakeCamera();
    const store = useCameraStore();
    // A capture of the running camera fails, then the camera is switched off.
    await store.start();
    await store.captureStill({
      grab: () => {
        throw new CameraError('noCanvas');
      },
      nextFrame: () => Promise.resolve(),
    });
    expect(store.errorMessage).not.toBeNull();
    store.stop();
    expect(store.errorMessage).toBeNull();
    // A start that failed goes as well.
    installFakeCamera({ open: () => Promise.reject(new CameraError('permissionDenied')) });
    await store.start();
    expect(store.status).toBe('error');
    store.stop();
    expect(store.errorMessage).toBeNull();
  });

  it('restarts the running session on a repeated start', async () => {
    const api = installFakeCamera();
    const store = useCameraStore();
    await store.start();
    await store.start();
    expect(api.close).toHaveBeenCalledTimes(1);
    expect(api.open).toHaveBeenCalledTimes(2);
  });

  it('switches the device immediately only in live mode', async () => {
    const api = installFakeCamera();
    const store = useCameraStore();
    await store.selectDevice('cam2');
    expect(store.selectedDeviceId).toBe('cam2');
    expect(api.open).not.toHaveBeenCalled();
    await store.start();
    await store.selectDevice('cam1');
    expect(api.open).toHaveBeenLastCalledWith('cam1', { width: 1280, height: 720 });
  });

  it('switches the resolution immediately only in live mode', async () => {
    const api = installFakeCamera();
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
    installFakeCamera();
    const store = useCameraStore();
    const grab = vi.fn(() => ({ width: 1, height: 1, data: [255, 255, 255, 255] }));
    await store.captureStill({ grab, nextFrame: () => Promise.resolve() });
    expect(store.still?.width).toBe(1);
    expect(grab).toHaveBeenCalledTimes(8);
    expect(store.errorMessage).toBeNull();
  });

  it('reports errors during capture in the language shown', async () => {
    installFakeCamera();
    const store = useCameraStore();
    const failing = (thrown: Error) => ({
      grab: () => {
        throw thrown;
      },
      nextFrame: () => Promise.resolve(),
    });
    await store.captureStill(failing(new CameraError('noCanvas')));
    expect(store.errorMessage).toBe('Canvas-Kontext nicht verfügbar.');
    expect(store.still).toBeNull();
    i18n.global.locale.value = 'en';
    expect(store.errorMessage).toBe('Canvas context not available.');
    // What the browser throws is a failed capture.
    await store.captureStill(failing(new DOMException('', 'SecurityError')));
    expect(store.errorMessage).toBe('Capture failed.');
  });

  it('discards the still image on clearing and on every camera start', async () => {
    installFakeCamera();
    const store = useCameraStore();
    const grabber = {
      grab: () => ({ width: 1, height: 1, data: [0, 0, 0, 0] }),
      nextFrame: () => Promise.resolve(),
    };
    await store.captureStill(grabber);
    store.clearStill();
    expect(store.still).toBeNull();
    await store.captureStill(grabber);
    await store.start();
    expect(store.still).toBeNull();
  });

  it('stores the still image when switching steps and restores the image of the other step', async () => {
    installFakeCamera();
    const store = useCameraStore();
    const grabber = {
      grab: () => ({ width: 1, height: 1, data: [0, 0, 0, 0] }),
      nextFrame: () => Promise.resolve(),
    };
    await store.captureStill(grabber);
    const gray = store.still;
    store.swapStill('gray', 'color');
    expect(store.still).toBeNull();
    await store.captureStill(grabber);
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
    await store.captureStill(grabber);
    store.discardStills();
    store.swapStill('gray', 'color');
    expect(store.still).toBeNull();
  });

  describe('search with held still image', () => {
    const grabber = {
      grab: () => ({ width: 1, height: 1, data: [255, 0, 0, 255] }),
      nextFrame: () => Promise.resolve(),
    };

    it('holds the previous still image on camera start and returns it on stop', async () => {
      installFakeCamera();
      const store = useCameraStore();
      const old = grayFrame(1, 1, 0.2);
      store.still = old;
      await store.start();
      expect(store.still).toBeNull();
      expect(store.allStills().gray).toBe(old);
      store.stop();
      expect(store.still).toBe(old);
      expect(store.allStills().gray).toBe(old);
    });

    it('keeps a new still image and drops the previous one', async () => {
      installFakeCamera();
      const store = useCameraStore();
      const old = grayFrame(1, 1, 0.2);
      store.still = old;
      await store.start();
      await store.captureStill(grabber);
      const fresh = store.still;
      expect(fresh).not.toBeNull();
      store.stop();
      expect(store.still).toBe(fresh);
      expect(store.still).not.toBe(old);
    });

    it('returns the previous still image even after a start error', async () => {
      installFakeCamera({ open: vi.fn().mockRejectedValue(new CameraError('permissionDenied')) });
      const store = useCameraStore();
      const old = grayFrame(1, 1, 0.2);
      store.still = old;
      await store.start();
      expect(store.status).toBe('error');
      expect(store.still).toBe(old);
    });

    it('also deletes the held still image with clearStill and discardStills', async () => {
      installFakeCamera();
      const store = useCameraStore();
      store.still = grayFrame(1, 1, 0.2);
      await store.start();
      store.clearStill();
      store.stop();
      expect(store.still).toBeNull();
      store.still = grayFrame(1, 1, 0.3);
      await store.start();
      store.discardStills();
      store.stop();
      expect(store.still).toBeNull();
    });

    it('stores the still image on tab switch with a running camera and holds the image of the new tab', async () => {
      installFakeCamera();
      const store = useCameraStore();
      const grayStill = grayFrame(1, 1, 0.1);
      store.still = grayStill;
      store.swapStill('gray', 'color');
      const colorStill = grayFrame(1, 1, 0.2);
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
    installFakeCamera();
    const store = useCameraStore();
    expect(store.stillOwner).toBe('gray');
    expect(store.allStills()).toEqual({});

    store.still = grayFrame(1, 1, 0.1);
    store.swapStill('gray', 'color');
    expect(store.stillOwner).toBe('color');
    store.still = grayFrame(1, 1, 0.2);
    const stills = store.allStills();
    expect(Object.keys(stills)).toHaveLength(2);
    expect(stills.color?.data[0]).toBeCloseTo(0.2);
    expect(stills.gray?.data[0]).toBeCloseTo(0.1);

    store.discardStills();
    expect(store.allStills()).toEqual({});
    store.restoreStills({
      gray: grayFrame(1, 1, 0.3),
      color: grayFrame(1, 1, 0.4),
      preview: grayFrame(1, 1, 0.5),
    });
    // The owner's image (color charts) is shown, the others are parked.
    expect(shown(store)).toBeCloseTo(0.4);
    store.swapStill('color', 'preview');
    expect(shown(store)).toBeCloseTo(0.5);
    store.restoreStills({});
    expect(store.still).toBeNull();
  });
});
