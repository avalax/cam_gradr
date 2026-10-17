import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCameraStore } from '../camera/camera-store';
import type { Frame } from '../camera/frame';
import { useChartStore } from '../chart/chart-store';
import { FAKE_STREAM, installFakeCamera, installMediaStubs } from '../test-support/media';

import GrayStep from './GrayStep.vue';

const CORNERS = [
  [100, 50],
  [500, 50],
  [500, 650],
  [100, 650],
  [700, 50],
  [1100, 50],
  [1100, 650],
  [700, 650],
] as const;

function stillFrame(value: number): Frame {
  return {
    width: 1280,
    height: 720,
    data: new Float32Array(1280 * 720 * 3).fill(value),
  };
}

// Nach dem Einhängen aufrufen: ersetzt nur die Canvas-Erzeugung für den Frame-Grabber.
function mockGrabberCanvas(value: number) {
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- Überladung für beliebige Tag-Namen
  const original = document.createElement.bind(document);
  const data = new Uint8ClampedArray(1280 * 720 * 4).fill(value);
  const context = {
    drawImage: vi.fn(),
    getImageData: () => ({ width: 1280, height: 720, data }),
  };
  vi.spyOn(document, 'createElement').mockImplementation(
    (tag: string, options?: ElementCreationOptions) =>
      tag === 'canvas'
        ? ({ width: 0, height: 0, getContext: () => context } as unknown as HTMLCanvasElement)
        : original(tag, options),
  );
}

async function mountLive() {
  installFakeCamera();
  const wrapper = mount(GrayStep);
  await useCameraStore().start();
  await flushPromises();
  await wrapper.get('video').trigger('loadeddata');
  return wrapper;
}

type Wrapper = Awaited<ReturnType<typeof mountLive>>;

async function clickAt(wrapper: Wrapper, x: number, y: number) {
  await wrapper.get('svg').trigger('click', { clientX: x, clientY: y });
}

async function placeAll(wrapper: Wrapper) {
  for (const [x, y] of CORNERS) {
    await clickAt(wrapper, x, y);
  }
}

function button(wrapper: Wrapper, text: string) {
  return wrapper.findAll('button').find((b) => b.text().includes(text));
}

describe('GrayStep', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    installMediaStubs();
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 1280,
      height: 720,
    } as DOMRect);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      putImageData: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('weist bei ausgeschalteter Kamera auf den Kameraschalter hin', () => {
    installFakeCamera();
    const wrapper = mount(GrayStep);
    expect(wrapper.text()).toContain('Die Kamera ist aus');
    expect(wrapper.text()).toContain('ein Standbild aufnehmen');
    expect(wrapper.text()).toContain('Noch keine Messung');
    expect(wrapper.find('select').exists()).toBe(false);
    expect(button(wrapper, 'Standbild aufnehmen')?.attributes('disabled')).toBeDefined();
  });

  it('erlaubt die Aufnahme erst, wenn das Video ein Bild liefert', async () => {
    installFakeCamera();
    const wrapper = mount(GrayStep);
    await useCameraStore().start();
    await flushPromises();
    expect(wrapper.text()).toContain('Die Kamera startet');
    expect(button(wrapper, 'Standbild aufnehmen')?.attributes('disabled')).toBeDefined();
    await wrapper.get('video').trigger('loadeddata');
    expect(wrapper.text()).not.toContain('Die Kamera startet');
    expect(button(wrapper, 'Standbild aufnehmen')?.attributes('disabled')).toBeUndefined();
  });

  it('sperrt die Aufnahme erneut, wenn der Stream wechselt', async () => {
    const wrapper = await mountLive();
    expect(button(wrapper, 'Standbild aufnehmen')?.attributes('disabled')).toBeUndefined();
    await useCameraStore().start();
    await flushPromises();
    expect(button(wrapper, 'Standbild aufnehmen')?.attributes('disabled')).toBeDefined();
  });

  it('verbindet den laufenden Stream mit dem Video', async () => {
    const wrapper = await mountLive();
    expect(wrapper.get('video').element.srcObject).toBe(FAKE_STREAM);
    expect(wrapper.text()).not.toContain('Die Kamera ist aus');
  });

  it('begrenzt die Bildbreite, damit Bild und Knöpfe auf einen Bildschirm passen', async () => {
    const wrapper = await mountLive();
    const style = wrapper.get('div.relative.min-w-0').attributes('style');
    expect(style).toContain('max-width: calc((100vh - 12rem) * 1.77');
  });

  it('bindet Stream und vorhandenes Standbild beim Einhängen an', async () => {
    installFakeCamera();
    const camera = useCameraStore();
    await camera.start();
    camera.still = stillFrame(0.5);
    const wrapper = mount(GrayStep);
    expect(wrapper.get('video').element.srcObject).toBe(FAKE_STREAM);
    expect(wrapper.text()).toContain('Neues Standbild aufnehmen');
  });

  it('nimmt per Knopf ein Standbild auf und zeigt es an', async () => {
    const wrapper = await mountLive();
    const video = wrapper.get('video').element;
    Object.defineProperties(video, {
      videoWidth: { value: 1280 },
      videoHeight: { value: 720 },
      requestVideoFrameCallback: {
        value: (callback: () => void) => {
          callback();
          return 1;
        },
      },
    });
    mockGrabberCanvas(128);
    await button(wrapper, 'Standbild aufnehmen')?.trigger('click');
    await flushPromises();
    expect(useCameraStore().still).not.toBeNull();
    expect(wrapper.text()).toContain('Neues Standbild aufnehmen');
    expect(wrapper.text()).toContain('Zurück zum Livebild');
    expect(wrapper.text()).toContain('oben links der linke Graukarte');
  });

  it('zeigt Fehler bei der Aufnahme an', async () => {
    const wrapper = await mountLive();
    useCameraStore().errorMessage = 'Aufnahme fehlgeschlagen.';
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('Aufnahme fehlgeschlagen');
  });

  it('nimmt Eckpunkte nur auf dem Standbild an', async () => {
    const wrapper = await mountLive();
    await clickAt(wrapper, 640, 360);
    expect(useChartStore().points).toEqual({});
    useCameraStore().still = stillFrame(0.5);
    await flushPromises();
    await clickAt(wrapper, 640, 360);
    expect(useChartStore().points[3]).toEqual([{ x: 640, y: 360 }]);
    expect(wrapper.findAll('circle')).toHaveLength(1);
    expect(wrapper.text()).toContain('oben rechts');
  });

  it('verschiebt einen Eckpunkt per Ziehen und beendet das Ziehen', async () => {
    const wrapper = await mountLive();
    useCameraStore().still = stillFrame(0.5);
    await flushPromises();
    await clickAt(wrapper, 100, 100);
    await wrapper.get('circle').trigger('pointerdown');
    await wrapper.get('svg').trigger('pointermove', { clientX: 300, clientY: 200 });
    expect(useChartStore().points[3]).toEqual([{ x: 300, y: 200 }]);
    await wrapper.get('svg').trigger('pointerup');
    await wrapper.get('svg').trigger('pointermove', { clientX: 500, clientY: 500 });
    expect(useChartStore().points[3]).toEqual([{ x: 300, y: 200 }]);
    await wrapper.get('circle').trigger('pointerdown');
    await wrapper.get('svg').trigger('pointerleave');
    await wrapper.get('svg').trigger('pointermove', { clientX: 10, clientY: 10 });
    expect(useChartStore().points[3]).toEqual([{ x: 300, y: 200 }]);
  });

  it('nummeriert die Eckpunkte pro Karte', async () => {
    const wrapper = await mountLive();
    useCameraStore().still = stillFrame(0.5);
    await flushPromises();
    await clickAt(wrapper, 100, 100);
    await clickAt(wrapper, 300, 100);
    const labels = wrapper.findAll('[data-testid="corner-label"]').map((label) => label.text());
    expect(labels).toEqual(['1', '2']);
  });

  it('setzt beim Klick auf einen Eckpunkt keinen neuen', async () => {
    const wrapper = await mountLive();
    useCameraStore().still = stillFrame(0.5);
    await flushPromises();
    await clickAt(wrapper, 100, 100);
    await wrapper.get('circle').trigger('click');
    expect(useChartStore().points[3]).toHaveLength(1);
  });

  it('misst das Standbild, sobald alle Eckpunkte gesetzt sind, und zeigt die Skala', async () => {
    const wrapper = await mountLive();
    useCameraStore().still = stillFrame(0.5);
    await flushPromises();
    expect(useChartStore().exposure).toBeNull();
    await placeAll(wrapper);
    await flushPromises();
    expect(useChartStore().ready).toBe(true);
    expect(useChartStore().exposure).not.toBeNull();
    expect(wrapper.find('[data-testid="scale-marker"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('18 %-Feld');
    expect(wrapper.findAll('polygon').length).toBeGreaterThan(10);
  });

  it('misst bei einem neuen Standbild mit den vorhandenen Eckpunkten erneut', async () => {
    const wrapper = await mountLive();
    const camera = useCameraStore();
    camera.still = stillFrame(0.3);
    await flushPromises();
    await placeAll(wrapper);
    await flushPromises();
    const dark = useChartStore().exposure?.level18;
    camera.still = stillFrame(0.8);
    await flushPromises();
    expect(useChartStore().exposure?.level18).toBeGreaterThan(dark ?? 1);
  });

  it('kehrt zum Livebild zurück und misst dort mit denselben Eckpunkten', async () => {
    vi.useFakeTimers();
    const wrapper = await mountLive();
    const camera = useCameraStore();
    const chart = useChartStore();
    camera.still = stillFrame(0.5);
    await flushPromises();
    await placeAll(wrapper);
    await flushPromises();
    await button(wrapper, 'Zurück zum Livebild')?.trigger('click');
    expect(camera.still).toBeNull();
    expect(wrapper.text()).not.toContain('Zurück zum Livebild');
    expect(wrapper.findAll('circle')).toHaveLength(0);
    Object.defineProperty(wrapper.get('video').element, 'videoWidth', { value: 1280 });
    mockGrabberCanvas(60);
    const measure = vi.spyOn(chart, 'measure');
    await vi.advanceTimersByTimeAsync(300);
    expect(measure).toHaveBeenCalledTimes(1);
  });

  it('misst im Livebild nicht, solange ein Standbild angezeigt wird', async () => {
    vi.useFakeTimers();
    const wrapper = await mountLive();
    const chart = useChartStore();
    useCameraStore().still = stillFrame(0.5);
    await flushPromises();
    await placeAll(wrapper);
    await flushPromises();
    mockGrabberCanvas(60);
    const measure = vi.spyOn(chart, 'measure');
    await vi.advanceTimersByTimeAsync(1000);
    expect(measure).not.toHaveBeenCalled();
  });

  it('setzt per Knopf zurück', async () => {
    const wrapper = await mountLive();
    useCameraStore().still = stillFrame(0.5);
    await flushPromises();
    await placeAll(wrapper);
    await button(wrapper, 'Eckpunkte zurücksetzen')?.trigger('click');
    expect(useChartStore().points).toEqual({});
    expect(wrapper.findAll('polygon')).toHaveLength(0);
  });

  it('beginnt bei geänderter Auflösung neu, nicht bei gleicher oder fehlender', async () => {
    const wrapper = await mountLive();
    const camera = useCameraStore();
    const chart = useChartStore();
    camera.still = stillFrame(0.5);
    await flushPromises();
    await clickAt(wrapper, 100, 100);
    camera.actual = { width: 1280, height: 720 };
    await flushPromises();
    expect(chart.points[3]).toHaveLength(1);
    camera.actual = null;
    await flushPromises();
    expect(chart.points[3]).toHaveLength(1);
    camera.actual = { width: 640, height: 480 };
    await flushPromises();
    expect(chart.points[3]).toHaveLength(1);
    camera.actual = { width: 640, height: 400 };
    await flushPromises();
    expect(chart.points).toEqual({});
  });

  it('meldet „continue“ nur bei grüner Skala', async () => {
    const wrapper = await mountLive();
    const next = () => button(wrapper, 'Weiter');
    expect(next()?.attributes('disabled')).toBeDefined();
    useChartStore().exposure = {
      verdict: 'ok',
      highlightsClipped: false,
      shadowsCrushed: false,
      level18: 0.46,
      level50: 0.74,
      delta: 0,
    };
    await flushPromises();
    expect(next()?.attributes('disabled')).toBeUndefined();
    await next()?.trigger('click');
    expect(wrapper.emitted('continue')).toHaveLength(1);
    expect(wrapper.text()).toContain('Lichter');
  });

  it('zeigt Clipping und abgesoffene Schatten an', async () => {
    const wrapper = await mountLive();
    useChartStore().exposure = {
      verdict: 'high-contrast',
      highlightsClipped: true,
      shadowsCrushed: true,
      level18: 0.5,
      level50: 0.8,
      delta: 0.03,
    };
    await flushPromises();
    expect(wrapper.text()).toContain('geclippt');
    expect(wrapper.text()).toContain('abgesoffen');
  });

  it('stoppt die Messung beim Entfernen', async () => {
    vi.useFakeTimers();
    const wrapper = await mountLive();
    const measure = vi.spyOn(useChartStore(), 'measure');
    wrapper.unmount();
    await vi.advanceTimersByTimeAsync(1000);
    expect(measure).not.toHaveBeenCalled();
  });
});
