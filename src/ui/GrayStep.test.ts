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

// Zwei hochkante Karten mit dunklem Rahmen und hellen Feldern auf ruhigem Hintergrund.
function twoCardFrame(shift = 0): Frame {
  const frame = { width: 1280, height: 720, data: new Float32Array(1280 * 720 * 3).fill(0.6) };
  for (const x0 of [200 + shift, 760 + shift]) {
    for (let y = 100; y < 600; y++) {
      for (let x = x0; x < x0 + 320; x++) {
        const inside = x >= x0 + 40 && x < x0 + 280 && y >= 140 && y < 560;
        frame.data.fill(inside ? 0.8 : 0.08, (y * 1280 + x) * 3, (y * 1280 + x) * 3 + 3);
      }
    }
  }
  return frame;
}

function toRgba(frame: Frame): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(frame.width * frame.height * 4).fill(255);
  for (let index = 0; index < frame.width * frame.height; index++) {
    for (let channel = 0; channel < 3; channel++) {
      rgba[index * 4 + channel] = Math.round(Number(frame.data[index * 3 + channel]) * 255);
    }
  }
  return rgba;
}

// Nach dem Einhängen aufrufen: ersetzt nur die Canvas-Erzeugung für den Frame-Grabber.
function mockGrabberCanvas(value: number) {
  mockGrabberData(() => new Uint8ClampedArray(1280 * 720 * 4).fill(value));
}

// Wie mockGrabberCanvas, die Bilddaten werden bei jedem Auslesen neu erfragt.
function mockGrabberData(next: () => Uint8ClampedArray) {
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- Überladung für beliebige Tag-Namen
  const original = document.createElement.bind(document);
  const context = {
    drawImage: vi.fn(),
    getImageData: () => ({ width: 1280, height: 720, data: next() }),
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

  it('misst das Standbild, sobald alle Eckpunkte gesetzt sind, und zeigt das Messfeld', async () => {
    const wrapper = await mountLive();
    useCameraStore().still = stillFrame(0.5);
    await flushPromises();
    expect(useChartStore().exposure).toBeNull();
    await placeAll(wrapper);
    await flushPromises();
    expect(useChartStore().ready).toBe(true);
    expect(useChartStore().exposure).not.toBeNull();
    expect(wrapper.find('[data-testid="measure-marker"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('18 %-Karte');
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

  it('zeigt neben dem Bild ein Messfeld für Helligkeit und Kontrast', async () => {
    const wrapper = await mountLive();
    expect(wrapper.find('[data-testid="measure-field"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="measure-hint"]').exists()).toBe(true);
  });

  it('zeigt im Livebild zwei beschriftete Rahmen, wo die Karten hingehalten werden sollen', async () => {
    const wrapper = await mountLive();
    const guides = wrapper.findAll('[data-testid="guide"]');
    expect(guides).toHaveLength(2);
    expect(guides[0]?.text()).toContain('linke Graukarte (50 %)');
    expect(guides[1]?.text()).toContain('rechte Graukarte (18 %)');
  });

  it('setzt per Knopf die Eckpunkte auf die Rahmen und blendet sie danach aus', async () => {
    const wrapper = await mountLive();
    useCameraStore().still = stillFrame(0.5);
    await flushPromises();
    await button(wrapper, 'Eckpunkte auf Rahmen setzen')?.trigger('click');
    expect(useChartStore().ready).toBe(true);
    expect(wrapper.findAll('[data-testid="guide"]')).toHaveLength(0);
    expect(wrapper.get('[data-testid="detect-message"]').text()).toContain('Rahmen');
  });

  it('erkennt beide Karten im Standbild und setzt die Eckpunkte', async () => {
    const wrapper = await mountLive();
    const camera = useCameraStore();
    camera.still = twoCardFrame();
    await flushPromises();
    await button(wrapper, 'Karten automatisch erkennen')?.trigger('click');
    expect(useChartStore().ready).toBe(true);
    expect(wrapper.get('[data-testid="detect-message"]').text()).toContain('erkannt');
    camera.still = stillFrame(0.5);
    await flushPromises();
    expect(wrapper.find('[data-testid="detect-message"]').exists()).toBe(false);
  });

  it('meldet, wenn keine Karten erkannt werden, und lässt die Eckpunkte unberührt', async () => {
    const wrapper = await mountLive();
    useCameraStore().still = stillFrame(0.5);
    await flushPromises();
    await button(wrapper, 'Karten automatisch erkennen')?.trigger('click');
    expect(wrapper.get('[data-testid="detect-message"]').text()).toContain('nicht sicher erkannt');
    expect(useChartStore().points).toEqual({});
  });

  it('bietet die Erkennung nur mit Standbild an', async () => {
    const wrapper = await mountLive();
    expect(button(wrapper, 'Karten automatisch erkennen')).toBeUndefined();
  });

  describe('automatische Aufnahme im Livebild', { timeout: 30_000 }, () => {
    // Einmal berechnet, weil die Automatik das Bild mehrfach ausliest.
    const cardsData = toRgba(twoCardFrame());
    const movedData = toRgba(twoCardFrame(120));
    const emptyData = new Uint8ClampedArray(1280 * 720 * 4).fill(153);
    const cards = () => cardsData;
    const empty = () => emptyData;

    async function mountAuto(next: () => Uint8ClampedArray) {
      vi.useFakeTimers();
      const wrapper = await mountLive();
      Object.defineProperties(wrapper.get('video').element, {
        videoWidth: { value: 1280 },
        videoHeight: { value: 720 },
        requestVideoFrameCallback: {
          value: (callback: () => void) => {
            callback();
            return 1;
          },
        },
      });
      mockGrabberData(next);
      return wrapper;
    }

    it('nimmt das Standbild selbst auf, setzt die Ecken und schaltet die Kamera aus', async () => {
      const wrapper = await mountAuto(cards);
      expect(wrapper.find('[data-testid="auto-hint"]').exists()).toBe(true);
      await vi.advanceTimersByTimeAsync(2500);
      await flushPromises();
      expect(useCameraStore().still).not.toBeNull();
      expect(useCameraStore().status).toBe('idle');
      expect(useChartStore().ready).toBe(true);
      expect(wrapper.get('[data-testid="detect-message"]').text()).toContain(
        'Standbild aufgenommen',
      );
      expect(wrapper.find('[data-testid="auto-hint"]').exists()).toBe(false);
    });

    it('verwirft ein Standbild, das nicht zu den Ecken aus dem Livebild passt', async () => {
      let reads = 0;
      await mountAuto(() => (reads++ < 2 ? cards() : movedData));
      await vi.advanceTimersByTimeAsync(2500);
      await flushPromises();
      expect(useCameraStore().still).toBeNull();
      expect(useCameraStore().status).toBe('live');
      expect(useChartStore().points).toEqual({});
    });

    it('wartet, bis die Karten ruhig gehalten werden', async () => {
      let reads = 0;
      await mountAuto(() => (reads++ < 1 ? cards() : movedData));
      await vi.advanceTimersByTimeAsync(2500);
      expect(useCameraStore().still).toBeNull();
      await vi.advanceTimersByTimeAsync(2000);
      await flushPromises();
      expect(useCameraStore().still).not.toBeNull();
      expect(useChartStore().ready).toBe(true);
    });

    it('wartet weiter, solange keine Karten zu sehen sind', async () => {
      await mountAuto(empty);
      await vi.advanceTimersByTimeAsync(5000);
      expect(useCameraStore().still).toBeNull();
      expect(useCameraStore().status).toBe('live');
    });

    it('verlangt zwei Treffer hintereinander', async () => {
      let visible = true;
      await mountAuto(() => (visible ? cards() : empty()));
      await vi.advanceTimersByTimeAsync(1000);
      visible = false;
      await vi.advanceTimersByTimeAsync(3000);
      expect(useCameraStore().still).toBeNull();
    });

    it('ist abschaltbar', async () => {
      const wrapper = await mountAuto(cards);
      await wrapper.get('input[type="checkbox"]').setValue(false);
      await vi.advanceTimersByTimeAsync(4000);
      expect(useCameraStore().still).toBeNull();
      expect(wrapper.find('[data-testid="auto-hint"]').exists()).toBe(false);
    });

    it('läuft nicht, wenn die Eckpunkte schon gesetzt sind', async () => {
      await mountAuto(cards);
      for (const [x, y] of CORNERS) {
        useChartStore().addCorner({ x, y });
      }
      await vi.advanceTimersByTimeAsync(4000);
      expect(useCameraStore().still).toBeNull();
    });

    it('wartet mit dem Suchen, bis das Video ein Bild liefert', async () => {
      vi.useFakeTimers();
      await mountLive();
      mockGrabberData(cards);
      await vi.advanceTimersByTimeAsync(4000);
      expect(useCameraStore().still).toBeNull();
    });
  });

  it('setzt per Knopf zurück', async () => {
    const wrapper = await mountLive();
    useCameraStore().still = stillFrame(0.5);
    await flushPromises();
    await placeAll(wrapper);
    await button(wrapper, 'Eckpunkte zurücksetzen')?.trigger('click');
    expect(useChartStore().points).toEqual({});
    expect(wrapper.findAll('polygon[data-shape]')).toHaveLength(0);
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

  it('meldet „continue“ nur bei Messung im Normalbereich', async () => {
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
      contrast: 0,
    };
    await flushPromises();
    expect(next()?.attributes('disabled')).toBeUndefined();
    await next()?.trigger('click');
    expect(wrapper.emitted('continue')).toHaveLength(1);
    expect(wrapper.text()).toContain('Lichter');
  });

  it('zeigt überbelichtete Lichter und unterbelichtete Schatten an', async () => {
    const wrapper = await mountLive();
    useChartStore().exposure = {
      verdict: 'high-contrast',
      highlightsClipped: true,
      shadowsCrushed: true,
      level18: 0.5,
      level50: 0.8,
      delta: 0.03,
      contrast: 0,
    };
    await flushPromises();
    expect(wrapper.text()).toContain('überbelichtet');
    expect(wrapper.text()).toContain('unterbelichtet');
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
