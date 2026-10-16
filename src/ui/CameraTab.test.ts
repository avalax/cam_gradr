import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCameraStore } from '../camera/camera-store';
import { FAKE_STREAM, installFakeCamera, installMediaStubs } from '../test-support/media';

import CameraTab from './CameraTab.vue';

function button(wrapper: ReturnType<typeof mount>, text: string) {
  return wrapper.findAll('button').find((b) => b.text().includes(text));
}

function stillFrame() {
  return { width: 16, height: 9, data: new Float32Array(16 * 9 * 3).fill(0.5) };
}

describe('CameraTab', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    installMediaStubs();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      putImageData: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('startet mit ausgeschalteter Kamera und zeigt Hinweis statt Kameraoptionen', () => {
    installFakeCamera();
    const wrapper = mount(CameraTab);
    expect(button(wrapper, 'Kamera aus')?.attributes('aria-pressed')).toBe('true');
    expect(button(wrapper, 'Kamera an')?.attributes('aria-pressed')).toBe('false');
    expect(wrapper.find('select').exists()).toBe(false);
    expect(wrapper.get('[data-testid="camera-off-hint"]').text()).toContain('Die Kamera ist aus');
    expect(wrapper.text()).toContain('Noch kein Standbild aufgenommen');
    expect(wrapper.find('video').exists()).toBe(false);
  });

  it('zeigt bei eingeschalteter Kamera alle Optionen und das Livebild', async () => {
    installFakeCamera();
    const wrapper = mount(CameraTab);
    await button(wrapper, 'Kamera an')?.trigger('click');
    await flushPromises();
    expect(button(wrapper, 'Kamera an')?.attributes('aria-pressed')).toBe('true');
    expect(wrapper.findAll('select')).toHaveLength(2);
    expect(wrapper.get('[role="note"]').text()).toContain('Auto-Belichtung');
    expect(wrapper.get('video').element.srcObject).toBe(FAKE_STREAM);
    expect(wrapper.find('[data-testid="camera-off-hint"]').exists()).toBe(false);
  });

  it('schaltet die Kamera wieder aus und tauscht Optionen und Bild aus', async () => {
    const api = installFakeCamera();
    const wrapper = mount(CameraTab);
    await button(wrapper, 'Kamera an')?.trigger('click');
    await flushPromises();
    await button(wrapper, 'Kamera aus')?.trigger('click');
    expect(api.close).toHaveBeenCalledTimes(1);
    expect(wrapper.find('select').exists()).toBe(false);
    expect(wrapper.find('video').exists()).toBe(false);
    expect(wrapper.find('[data-testid="camera-off-hint"]').exists()).toBe(true);
  });

  it('startet die Kamera bei erneutem Klick auf „Kamera an“ nicht neu', async () => {
    const api = installFakeCamera();
    const wrapper = mount(CameraTab);
    await button(wrapper, 'Kamera an')?.trigger('click');
    await flushPromises();
    await button(wrapper, 'Kamera an')?.trigger('click');
    await flushPromises();
    expect(api.open).toHaveBeenCalledTimes(1);
  });

  it('erlaubt die Aufnahme erst, wenn das Video ein Bild liefert', async () => {
    installFakeCamera();
    const wrapper = mount(CameraTab);
    await button(wrapper, 'Kamera an')?.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Die Kamera startet');
    expect(button(wrapper, 'Standbild aufnehmen')?.attributes('disabled')).toBeDefined();
    await wrapper.get('video').trigger('loadeddata');
    expect(wrapper.text()).not.toContain('Die Kamera startet');
    expect(button(wrapper, 'Standbild aufnehmen')?.attributes('disabled')).toBeUndefined();
  });

  it('sperrt die Aufnahme erneut, wenn der Stream wechselt', async () => {
    installFakeCamera();
    const wrapper = mount(CameraTab);
    await button(wrapper, 'Kamera an')?.trigger('click');
    await flushPromises();
    await wrapper.get('video').trigger('loadeddata');
    await useCameraStore().start();
    await flushPromises();
    expect(button(wrapper, 'Standbild aufnehmen')?.attributes('disabled')).toBeDefined();
  });

  it('nimmt ein Standbild auf und meldet es', async () => {
    installFakeCamera();
    const wrapper = mount(CameraTab);
    await button(wrapper, 'Kamera an')?.trigger('click');
    await flushPromises();
    const video = wrapper.get('video').element;
    Object.defineProperties(video, {
      videoWidth: { value: 16 },
      videoHeight: { value: 9 },
      requestVideoFrameCallback: {
        value: (callback: () => void) => {
          callback();
          return 1;
        },
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- Überladung für beliebige Tag-Namen
    const original = document.createElement.bind(document);
    const data = new Uint8ClampedArray(16 * 9 * 4).fill(100);
    const context = { drawImage: vi.fn(), getImageData: () => ({ width: 16, height: 9, data }) };
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) =>
      tag === 'canvas'
        ? ({ width: 0, height: 0, getContext: () => context } as unknown as HTMLCanvasElement)
        : original(tag),
    );
    await wrapper.get('video').trigger('loadeddata');
    await button(wrapper, 'Standbild aufnehmen')?.trigger('click');
    await flushPromises();
    expect(useCameraStore().still).not.toBeNull();
    expect(wrapper.text()).toContain('Ein Standbild liegt bereit');
    expect(button(wrapper, 'Neues Standbild aufnehmen')).toBeDefined();
  });

  it('zeigt im Modus „Kamera aus“ das vorhandene Standbild mit Größe', () => {
    installFakeCamera();
    const camera = useCameraStore();
    camera.still = stillFrame();
    const wrapper = mount(CameraTab);
    expect(wrapper.get('[data-testid="still-info"]').text()).toContain('16 × 9');
    expect(wrapper.text()).not.toContain('Noch kein Standbild aufgenommen');
    expect(wrapper.get('canvas').attributes('style')).toContain('max-width');
  });

  it('verwirft das Standbild per Knopf', async () => {
    installFakeCamera();
    const camera = useCameraStore();
    camera.still = stillFrame();
    const wrapper = mount(CameraTab);
    await button(wrapper, 'Standbild verwerfen')?.trigger('click');
    expect(camera.still).toBeNull();
    expect(wrapper.text()).toContain('Noch kein Standbild aufgenommen');
  });

  it('zeichnet ein neues Standbild im Modus „Kamera aus“', async () => {
    installFakeCamera();
    const wrapper = mount(CameraTab);
    useCameraStore().still = stillFrame();
    await flushPromises();
    expect(wrapper.find('[data-testid="still-info"]').exists()).toBe(true);
  });

  it('begrenzt die Bildbreite nach der Fensterhöhe', async () => {
    installFakeCamera();
    const wrapper = mount(CameraTab);
    await button(wrapper, 'Kamera an')?.trigger('click');
    await flushPromises();
    expect(wrapper.get('video').attributes('style')).toContain('max-width: calc((100vh - 10rem) *');
  });

  it('bindet einen laufenden Stream beim Einhängen an', async () => {
    installFakeCamera();
    await useCameraStore().start();
    const wrapper = mount(CameraTab);
    expect(wrapper.get('video').element.srcObject).toBe(FAKE_STREAM);
  });
});
