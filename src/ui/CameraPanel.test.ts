import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setCameraApi, useCameraStore } from '../camera/camera-store';
import type { CameraApi } from '../camera/types';

import CameraPanel from './CameraPanel.vue';

const STREAM = { id: 'stream' } as unknown as MediaStream;

function fakeApi(overrides: Partial<CameraApi> = {}) {
  const api = {
    enumerate: vi.fn(() =>
      Promise.resolve([
        { id: 'cam1', label: 'Webcam 1' },
        { id: 'cam2', label: 'Webcam 2' },
      ]),
    ),
    open: vi.fn((deviceId: string | null) =>
      Promise.resolve({
        stream: STREAM,
        settings: { width: 1280, height: 720, deviceId: deviceId ?? 'cam1' },
      }),
    ),
    close: vi.fn(),
    ...overrides,
  } satisfies CameraApi;
  setCameraApi(api);
  return api;
}

function mountPanel() {
  return mount(CameraPanel, { global: { plugins: [] } });
}

describe('CameraPanel', () => {
  let play: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setActivePinia(createPinia());
    play = vi.fn(() => Promise.resolve());
    Object.defineProperty(HTMLMediaElement.prototype, 'play', { value: play, configurable: true });
    // happy-dom akzeptiert nur echte MediaStreams; hier genügt ein einfacher Speicher.
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('zeigt Hinweis, Start-Knopf und deaktivierte Aufnahme', () => {
    fakeApi();
    const wrapper = mountPanel();
    expect(wrapper.get('[role="note"]').text()).toContain('Auto-Belichtung');
    expect(wrapper.text()).toContain('Kamera starten');
    expect(wrapper.text()).toContain('Noch kein Standbild');
    const capture = wrapper.findAll('button').find((b) => b.text().includes('Standbild'));
    expect(capture?.attributes('disabled')).toBeDefined();
  });

  it('startet die Kamera, verbindet den Stream und zeigt die Ist-Auflösung', async () => {
    fakeApi();
    const wrapper = mountPanel();
    await wrapper.get('button').trigger('click');
    await flushPromises();
    const video = wrapper.get('video').element;
    expect(video.srcObject).toBe(STREAM);
    expect(play).toHaveBeenCalled();
    expect(wrapper.text()).toContain('Aktive Auflösung: 1280 × 720');
    expect(wrapper.text()).toContain('Kamera stoppen');
    expect(wrapper.text()).toContain('Webcam 2');
  });

  it('stoppt die Kamera und löst den Stream vom Video', async () => {
    fakeApi();
    const wrapper = mountPanel();
    await wrapper.get('button').trigger('click');
    await flushPromises();
    const stop = wrapper.findAll('button').find((b) => b.text().includes('stoppen'));
    await stop?.trigger('click');
    await flushPromises();
    expect(wrapper.get('video').element.srcObject).toBeNull();
    expect(wrapper.text()).toContain('Kamera starten');
  });

  it('zeigt Fehlermeldungen an', async () => {
    fakeApi({ open: () => Promise.reject(new Error('x')) });
    const wrapper = mountPanel();
    await wrapper.get('button').trigger('click');
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('nicht gestartet');
  });

  it('wechselt Kamera und Auflösung', async () => {
    const api = fakeApi();
    const wrapper = mountPanel();
    await wrapper.get('button').trigger('click');
    await flushPromises();
    const [deviceSelect, resolutionSelect] = wrapper.findAll('select');
    await deviceSelect?.setValue('cam2');
    await flushPromises();
    expect(api.open).toHaveBeenLastCalledWith('cam2', { width: 1280, height: 720 });
    await deviceSelect?.setValue('');
    await flushPromises();
    expect(api.open).toHaveBeenLastCalledWith(null, { width: 1280, height: 720 });
    await resolutionSelect?.setValue('1920x1080');
    await flushPromises();
    expect(api.open).toHaveBeenLastCalledWith(expect.anything(), { width: 1920, height: 1080 });
  });

  it('ignoriert unbekannte Auflösungen', async () => {
    const api = fakeApi();
    const wrapper = mountPanel();
    const resolutionSelect = wrapper.findAll('select')[1];
    const element = resolutionSelect?.element as HTMLSelectElement;
    const option = document.createElement('option');
    option.value = '1x1';
    element.append(option);
    await resolutionSelect?.setValue('1x1');
    expect(api.open).not.toHaveBeenCalled();
  });

  it('nimmt ein Standbild auf und zeichnet es', async () => {
    fakeApi();
    const drawn = { putImageData: vi.fn() };
    const context = {
      ...drawn,
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      drawImage: vi.fn(),
      getImageData: () => ({ width: 2, height: 2, data: new Uint8ClampedArray(16).fill(255) }),
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      context as unknown as CanvasRenderingContext2D,
    );
    const wrapper = mountPanel();
    await wrapper.get('button').trigger('click');
    await flushPromises();
    Object.defineProperty(wrapper.get('video').element, 'videoWidth', { value: 2 });
    Object.defineProperty(wrapper.get('video').element, 'videoHeight', { value: 2 });
    Object.defineProperty(wrapper.get('video').element, 'requestVideoFrameCallback', {
      value: (callback: () => void) => {
        callback();
        return 1;
      },
    });
    const capture = wrapper.findAll('button').find((b) => b.text().includes('Standbild'));
    await capture?.trigger('click');
    await flushPromises();
    expect(drawn.putImageData).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).not.toContain('Noch kein Standbild');
  });

  it('überspringt das Zeichnen ohne 2D-Kontext', async () => {
    fakeApi();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const wrapper = mountPanel();
    const store = useCameraStore();
    await store.captureStill({
      grab: () => ({ width: 1, height: 1, data: [0, 0, 0, 0] }),
      nextFrame: () => Promise.resolve(),
    });
    await flushPromises();
    expect(store.still).not.toBeNull();
    wrapper.unmount();
  });

  it('stoppt die Kamera beim Entfernen der Komponente', async () => {
    const api = fakeApi();
    const wrapper = mountPanel();
    await wrapper.get('button').trigger('click');
    await flushPromises();
    wrapper.unmount();
    expect(api.close).toHaveBeenCalledTimes(1);
  });
});
