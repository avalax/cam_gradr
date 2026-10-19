import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCameraStore } from '../camera/camera-store';
import type { Frame } from '../camera/frame';
import { useChartStore } from '../chart/chart-store';
import type { Corners } from '../chart/types';
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
function mockGrabberCanvas() {
  mockGrabberData(() => new Uint8ClampedArray(1280 * 720 * 4).fill(60));
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

// Setzt die Eckpunkte beider Karten, wie es die automatische Erkennung tut.
function placeAll() {
  const corners = CORNERS.map(([x, y]) => ({ x, y }));
  useChartStore().setCards([
    corners.slice(0, 4) as unknown as Corners,
    corners.slice(4) as unknown as Corners,
  ]);
}

function button(wrapper: Wrapper, text: string) {
  return wrapper
    .findAll('button')
    .find((b) => b.text().includes(text) || b.attributes('aria-label') === text);
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
    expect(wrapper.text()).toContain('Die App erkennt sie selbst');
    expect(wrapper.text()).toContain('Noch keine Messung');
    expect(wrapper.find('select').exists()).toBe(false);
  });

  it('zeigt beim Start keinen Wartetext, damit der Seitenaufbau ruhig bleibt', async () => {
    installFakeCamera();
    const wrapper = mount(GrayStep);
    await useCameraStore().start();
    await flushPromises();
    expect(wrapper.text()).not.toContain('einen Moment bitte');
    expect(wrapper.find('[data-testid="auto-hint"]').exists()).toBe(false);
    await wrapper.get('video').trigger('loadeddata');
    expect(wrapper.find('[data-testid="auto-hint"]').exists()).toBe(true);
    expect(wrapper.text()).not.toContain('einen Moment bitte');
  });

  it('reserviert dem Video sein Seitenverhältnis, damit die Bildfläche beim Start nicht springt', async () => {
    const wrapper = await mountLive();
    expect(wrapper.get('video').attributes('style')).toContain('aspect-ratio: 1.77');
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
    expect(button(wrapper, 'Zurück zum Livebild')).toBeDefined();
  });

  it('zeigt Fehler bei der Aufnahme an', async () => {
    const wrapper = await mountLive();
    useCameraStore().errorMessage = 'Aufnahme fehlgeschlagen.';
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('Aufnahme fehlgeschlagen');
  });

  it('zeigt die Eckpunkte nur auf dem Standbild und weist dort auf das Ziehen hin', async () => {
    const wrapper = await mountLive();
    placeAll();
    await flushPromises();
    expect(wrapper.findAll('circle')).toHaveLength(0);
    useCameraStore().still = stillFrame(0.5);
    await flushPromises();
    expect(wrapper.findAll('circle')).toHaveLength(8);
    expect(wrapper.text()).toContain('ziehe sie bei Bedarf');
  });

  it('zeichnet gespeicherte Eckpunkte nicht über den Platzhalter, solange die Kamera aus ist', async () => {
    installFakeCamera();
    const wrapper = mount(GrayStep);
    placeAll();
    await flushPromises();
    expect(wrapper.find('[data-testid="card-placeholder"]').exists()).toBe(true);
    expect(wrapper.findAll('polygon')).toHaveLength(0);
    expect(wrapper.get('[data-testid="card-placeholder"]').text()).toContain(
      'Die Eckpunkte bleiben erhalten',
    );
    // Mit Livebild erscheinen die Umrisse wieder.
    await useCameraStore().start();
    await flushPromises();
    expect(wrapper.find('[data-testid="card-placeholder"]').exists()).toBe(false);
    expect(wrapper.findAll('polygon[data-shape]').length).toBeGreaterThan(0);
  });

  it('setzt per Klick keine Eckpunkte', async () => {
    const wrapper = await mountLive();
    useCameraStore().still = stillFrame(0.5);
    await flushPromises();
    await wrapper.get('svg').trigger('click', { clientX: 640, clientY: 360 });
    expect(useChartStore().points).toEqual({});
  });

  it('verschiebt einen Eckpunkt per Ziehen und beendet das Ziehen', async () => {
    const wrapper = await mountLive();
    placeAll();
    useCameraStore().still = stillFrame(0.5);
    await flushPromises();
    const first = () => useChartStore().points[3]?.[0];
    await wrapper.get('circle').trigger('pointerdown');
    await wrapper.get('svg').trigger('pointermove', { clientX: 300, clientY: 200 });
    expect(first()).toEqual({ x: 300, y: 200 });
    await wrapper.get('svg').trigger('pointerup');
    await wrapper.get('svg').trigger('pointermove', { clientX: 500, clientY: 500 });
    expect(first()).toEqual({ x: 300, y: 200 });
    await wrapper.get('circle').trigger('pointerdown');
    await wrapper.get('svg').trigger('pointerleave');
    await wrapper.get('svg').trigger('pointermove', { clientX: 10, clientY: 10 });
    expect(first()).toEqual({ x: 300, y: 200 });
  });

  it('nummeriert die Eckpunkte pro Karte', async () => {
    const wrapper = await mountLive();
    placeAll();
    useCameraStore().still = stillFrame(0.5);
    await flushPromises();
    const labels = wrapper.findAll('[data-testid="corner-label"]').map((label) => label.text());
    expect(labels).toEqual(['1', '2', '3', '4', '1', '2', '3', '4']);
  });

  it('misst das Standbild, sobald alle Eckpunkte gesetzt sind, und zeigt das Messfeld', async () => {
    const wrapper = await mountLive();
    useCameraStore().still = stillFrame(0.5);
    await flushPromises();
    expect(useChartStore().exposure).toBeNull();
    placeAll();
    await flushPromises();
    expect(useChartStore().ready).toBe(true);
    expect(useChartStore().exposure).not.toBeNull();
    expect(wrapper.find('[data-testid="measure-marker"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('18 %-Karte');
    expect(wrapper.findAll('polygon').length).toBeGreaterThan(10);
  });

  it('misst bei einem neuen Standbild mit den vorhandenen Eckpunkten erneut', async () => {
    await mountLive();
    const camera = useCameraStore();
    camera.still = stillFrame(0.3);
    await flushPromises();
    placeAll();
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
    placeAll();
    await flushPromises();
    await button(wrapper, 'Zurück zum Livebild')?.trigger('click');
    expect(camera.still).toBeNull();
    expect(button(wrapper, 'Zurück zum Livebild')).toBeUndefined();
    expect(wrapper.findAll('circle')).toHaveLength(0);
    Object.defineProperty(wrapper.get('video').element, 'videoWidth', { value: 1280 });
    mockGrabberCanvas();
    const measure = vi.spyOn(chart, 'measure');
    await vi.advanceTimersByTimeAsync(300);
    expect(measure).toHaveBeenCalledTimes(1);
  });

  it('misst im Livebild nicht, solange ein Standbild angezeigt wird', async () => {
    vi.useFakeTimers();
    await mountLive();
    const chart = useChartStore();
    useCameraStore().still = stillFrame(0.5);
    await flushPromises();
    placeAll();
    await flushPromises();
    mockGrabberCanvas();
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

    it('läuft nicht, wenn die Eckpunkte schon gesetzt sind', async () => {
      await mountAuto(cards);
      placeAll();
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

  it('beginnt mit „Eckpunkte löschen“ von vorn: Eckpunkte und Standbild fallen weg', async () => {
    const wrapper = await mountLive();
    useCameraStore().still = stillFrame(0.5);
    await flushPromises();
    placeAll();
    await button(wrapper, 'Eckpunkte löschen')?.trigger('click');
    expect(useChartStore().points).toEqual({});
    expect(useCameraStore().still).toBeNull();
    expect(wrapper.findAll('polygon[data-shape]')).toHaveLength(0);
    // Die Kamera läuft schon: kein neuer Start.
    expect(useCameraStore().status).toBe('live');
  });

  it('schaltet die Kamera mit „Eckpunkte löschen“ wieder ein, wenn sie aus ist', async () => {
    installFakeCamera();
    const wrapper = mount(GrayStep);
    const camera = useCameraStore();
    expect(camera.status).toBe('idle');
    expect(button(wrapper, 'Eckpunkte löschen')).toBeUndefined();
    camera.still = stillFrame(0.5);
    placeAll();
    await flushPromises();
    await button(wrapper, 'Eckpunkte löschen')?.trigger('click');
    await flushPromises();
    expect(camera.status).toBe('live');
  });

  it('beginnt bei geänderter Auflösung neu, nicht bei gleicher oder fehlender', async () => {
    await mountLive();
    const camera = useCameraStore();
    const chart = useChartStore();
    placeAll();
    camera.actual = { width: 1280, height: 720 };
    await flushPromises();
    expect(chart.ready).toBe(true);
    camera.actual = null;
    await flushPromises();
    expect(chart.ready).toBe(true);
    camera.actual = { width: 640, height: 480 };
    await flushPromises();
    expect(chart.ready).toBe(true);
    camera.actual = { width: 640, height: 400 };
    await flushPromises();
    expect(chart.points).toEqual({});
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
