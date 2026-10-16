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

describe('useCameraStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('startet die Kamera und übernimmt Gerät, Auflösung und Geräteliste', async () => {
    const api = fakeApi();
    const store = useCameraStore();
    await store.start();
    expect(store.status).toBe('live');
    expect(store.actual).toEqual({ width: 1280, height: 720 });
    expect(store.selectedDeviceId).toBe('cam1');
    expect(store.devices).toEqual([{ id: 'cam1', label: 'Webcam' }]);
    expect(api.open).toHaveBeenCalledWith(null, { width: 1280, height: 720 });
  });

  it('lässt die Geräteauswahl leer, wenn die Kamera keine ID meldet', async () => {
    fakeApi({ open: () => Promise.resolve(session('')) });
    const store = useCameraStore();
    await store.start();
    expect(store.selectedDeviceId).toBeNull();
  });

  it('meldet Fehler und gibt die Kamera frei', async () => {
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

  it('gibt die Sitzung frei, wenn das Auflisten nach dem Öffnen fehlschlägt', async () => {
    const api = fakeApi({ enumerate: () => Promise.reject(new CameraError('unknown')) });
    const store = useCameraStore();
    await store.start();
    expect(store.status).toBe('error');
    expect(api.close).toHaveBeenCalledTimes(1);
  });

  it('stoppt die Kamera', async () => {
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

  it('startet bei erneutem Start die laufende Sitzung neu', async () => {
    const api = fakeApi();
    const store = useCameraStore();
    await store.start();
    await store.start();
    expect(api.close).toHaveBeenCalledTimes(1);
    expect(api.open).toHaveBeenCalledTimes(2);
  });

  it('wechselt das Gerät nur im Livebetrieb sofort', async () => {
    const api = fakeApi();
    const store = useCameraStore();
    await store.selectDevice('cam2');
    expect(store.selectedDeviceId).toBe('cam2');
    expect(api.open).not.toHaveBeenCalled();
    await store.start();
    await store.selectDevice('cam1');
    expect(api.open).toHaveBeenLastCalledWith('cam1', { width: 1280, height: 720 });
  });

  it('wechselt die Auflösung nur im Livebetrieb sofort', async () => {
    const api = fakeApi();
    const store = useCameraStore();
    const full = RESOLUTIONS[2];
    if (full === undefined) {
      throw new Error('Auflösung fehlt');
    }
    await store.selectResolution(full);
    expect(store.resolution).toEqual(full);
    expect(api.open).not.toHaveBeenCalled();
    await store.start();
    await store.selectResolution({ width: 640, height: 480 });
    expect(api.open).toHaveBeenLastCalledWith('cam1', { width: 640, height: 480 });
  });

  it('nimmt ein gemitteltes Standbild auf', async () => {
    fakeApi();
    const store = useCameraStore();
    const grab = vi.fn(() => ({ width: 1, height: 1, data: [255, 255, 255, 255] }));
    await store.captureStill({ grab, nextFrame: () => Promise.resolve() }, 2);
    expect(store.still?.width).toBe(1);
    expect(grab).toHaveBeenCalledTimes(2);
    expect(store.errorMessage).toBeNull();
  });

  it('meldet Fehler bei der Aufnahme', async () => {
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

  it('nutzt eine Standardmeldung bei Nicht-Error-Fehlern', async () => {
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

  it('verwirft das Standbild beim Löschen und bei jedem Kamerastart', async () => {
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

  it('nutzt die Standardanzahl an Frames', async () => {
    fakeApi();
    const store = useCameraStore();
    const grab = vi.fn(() => ({ width: 1, height: 1, data: [0, 0, 0, 0] }));
    await store.captureStill({ grab, nextFrame: () => Promise.resolve() });
    expect(grab).toHaveBeenCalledTimes(8);
  });
});
