import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCameraStore } from '../camera/camera-store';
import type { Frame } from '../camera/frame';
import { useChartStore } from '../chart/chart-store';
import type { Corners } from '../chart/types';
import { setLocale } from '../lang';
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

// Two portrait cards with a dark frame and light patches on a calm background.
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

// Only the left one of the two cards is in the image.
function oneCardFrame(): Frame {
  const frame = twoCardFrame();
  for (let y = 100; y < 600; y++) {
    frame.data.fill(0.6, (y * 1280 + 760) * 3, (y * 1280 + 1080) * 3);
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

// Replaces the canvas creation for the frame grabber; image data is requested anew on every read.
function mockGrabberData(next: () => Uint8ClampedArray) {
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- overload for arbitrary tag names
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

// Sets the corner points of both cards, as the automatic detection does.
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

  it('points to the camera switch when the camera is off', () => {
    installFakeCamera();
    const wrapper = mount(GrayStep);
    expect(wrapper.text()).toContain('Die Kamera ist aus');
    expect(wrapper.text()).toContain('Die App erkennt sie selbst');
    expect(wrapper.text()).toContain('Noch keine Messung');
    expect(wrapper.find('select').exists()).toBe(false);
  });

  it('shows the English texts when the language is English', () => {
    installFakeCamera();
    setLocale('en');
    const wrapper = mount(GrayStep);
    expect(wrapper.text()).toContain('The camera is off');
    expect(wrapper.text()).toContain('Hold both gray cards steady where the subject will be');
    expect(wrapper.text()).toContain('This tab sets the room brightness');
    expect(wrapper.text()).toContain('No measurement yet.');
  });

  it('shows no waiting text at start so the page layout stays calm', async () => {
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

  it('reserves the video its aspect ratio so the image area does not jump at start', async () => {
    const wrapper = await mountLive();
    expect(wrapper.get('video').attributes('style')).toContain('aspect-ratio: 1.77');
  });

  it('connects the running stream to the video', async () => {
    const wrapper = await mountLive();
    expect(wrapper.get('video').element.srcObject).toBe(FAKE_STREAM);
    expect(wrapper.text()).not.toContain('Die Kamera ist aus');
  });

  it('limits the image width so image and buttons fit on one screen', async () => {
    const wrapper = await mountLive();
    const style = wrapper.get('div.min-w-0.flex-1').attributes('style');
    expect(style).toContain('max-width: calc((100vh - 12rem) * 1.77');
  });

  it('binds stream and existing still image on mount', async () => {
    installFakeCamera();
    const camera = useCameraStore();
    await camera.start();
    camera.still = stillFrame(0.5);
    const wrapper = mount(GrayStep);
    expect(wrapper.get('video').element.srcObject).toBe(FAKE_STREAM);
    expect(button(wrapper, 'Eckpunkte löschen')).toBeDefined();
    expect(button(wrapper, 'Zurück zum Livebild')).toBeUndefined();
  });

  it('shows capture errors', async () => {
    const wrapper = await mountLive();
    useCameraStore().errorMessage = 'Aufnahme fehlgeschlagen.';
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('Aufnahme fehlgeschlagen');
  });

  it('shows the corner points only on the still image and hints at dragging there', async () => {
    const wrapper = await mountLive();
    placeAll();
    await flushPromises();
    expect(wrapper.findAll('circle')).toHaveLength(0);
    useCameraStore().still = stillFrame(0.5);
    await flushPromises();
    expect(wrapper.findAll('circle')).toHaveLength(8);
    expect(wrapper.text()).toContain('ziehe sie bei Bedarf');
  });

  it('shows only the placeholder with the camera off and no still image, even with corner points', async () => {
    installFakeCamera();
    const wrapper = mount(GrayStep);
    placeAll();
    await flushPromises();
    expect(wrapper.find('[data-testid="card-placeholder"]').exists()).toBe(true);
    expect(wrapper.findAll('polygon')).toHaveLength(0);
    expect(wrapper.get('[data-testid="card-placeholder"]').text()).toContain('Beide Graukarten');
  });

  describe('search with held state', () => {
    it('holds still image and corner points on camera start and restores them on stop', async () => {
      installFakeCamera();
      const wrapper = mount(GrayStep);
      const camera = useCameraStore();
      const chart = useChartStore();
      camera.still = stillFrame(0.5);
      placeAll();
      await flushPromises();
      expect(wrapper.findAll('circle')).toHaveLength(8);
      expect(chart.ready).toBe(true);

      await camera.start();
      await flushPromises();
      // The live view searches anew: no corner points, no outlines, no old still image before it.
      expect(chart.points).toEqual({});
      expect(chart.exposure).toBeNull();
      expect(camera.still).toBeNull();
      expect(wrapper.findAll('circle')).toHaveLength(0);
      expect(wrapper.findAll('polygon[data-shape]')).toHaveLength(0);
      expect(chart.committed().points[3]).toHaveLength(4);

      // Without new corner points the previous state applies again after stopping.
      camera.stop();
      await flushPromises();
      expect(camera.still).not.toBeNull();
      expect(Object.keys(chart.points)).toHaveLength(2);
      expect(wrapper.findAll('circle')).toHaveLength(8);
      expect(chart.exposure).not.toBeNull();
    });

    it('keeps a new state when new corner points appear during the search', async () => {
      installFakeCamera();
      mount(GrayStep);
      const camera = useCameraStore();
      const chart = useChartStore();
      camera.still = stillFrame(0.5);
      placeAll();
      await flushPromises();
      await camera.start();
      await flushPromises();
      chart.setCards([
        [
          { x: 10, y: 10 },
          { x: 20, y: 10 },
          { x: 20, y: 20 },
          { x: 10, y: 20 },
        ],
        [
          { x: 30, y: 10 },
          { x: 40, y: 10 },
          { x: 40, y: 20 },
          { x: 30, y: 20 },
        ],
      ]);
      const fresh = stillFrame(0.7);
      camera.still = fresh;
      camera.stop();
      await flushPromises();
      expect(camera.still).toBe(fresh);
      expect(chart.points[3]?.[0]).toEqual({ x: 10, y: 10 });
    });

    it('also starts a search when the tab is opened while the camera is running', async () => {
      installFakeCamera();
      const camera = useCameraStore();
      await camera.start();
      placeAll();
      const wrapper = mount(GrayStep);
      await flushPromises();
      expect(useChartStore().points).toEqual({});
      wrapper.unmount();
      // Leaving the tab restores the previous state.
      expect(Object.keys(useChartStore().points)).toHaveLength(2);
    });

    it('discards the held state with the trash button', async () => {
      installFakeCamera();
      const wrapper = mount(GrayStep);
      const camera = useCameraStore();
      camera.still = stillFrame(0.5);
      placeAll();
      await flushPromises();
      // The trash button deletes still image and corner points and restarts the search with the
      // camera.
      await button(wrapper, 'Eckpunkte löschen')?.trigger('click');
      await flushPromises();
      expect(camera.status).toBe('live');
      camera.stop();
      await flushPromises();
      expect(useChartStore().points).toEqual({});
      expect(camera.still).toBeNull();
    });
  });

  it('never measures in the live view, only on still images', async () => {
    vi.useFakeTimers();
    await mountLive();
    const chart = useChartStore();
    const measure = vi.spyOn(chart, 'measure');
    placeAll();
    await vi.advanceTimersByTimeAsync(2000);
    expect(measure).not.toHaveBeenCalled();
    useCameraStore().still = stillFrame(0.5);
    await flushPromises();
    expect(measure).toHaveBeenCalled();
  });

  it('sets no corner points on click', async () => {
    const wrapper = await mountLive();
    useCameraStore().still = stillFrame(0.5);
    await flushPromises();
    await wrapper.get('svg').trigger('click', { clientX: 640, clientY: 360 });
    expect(useChartStore().points).toEqual({});
  });

  it('moves a corner point by dragging and ends the drag', async () => {
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

  it('numbers the corner points per card', async () => {
    const wrapper = await mountLive();
    placeAll();
    useCameraStore().still = stillFrame(0.5);
    await flushPromises();
    const labels = wrapper.findAll('[data-testid="corner-label"]').map((label) => label.text());
    expect(labels).toEqual(['1', '2', '3', '4', '1', '2', '3', '4']);
  });

  it('measures the still image once all corner points are set, and shows the measuring field', async () => {
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

  it('measures again with the existing corner points on a new still image', async () => {
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

  it('shows a measuring field for brightness and contrast next to the image', async () => {
    const wrapper = await mountLive();
    expect(wrapper.find('[data-testid="measure-field"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="measure-hint"]').exists()).toBe(true);
  });

  it('shows the live view text in English', async () => {
    setLocale('en');
    const wrapper = await mountLive();
    expect(wrapper.get('[data-testid="auto-hint"]').text()).toContain(
      'Hold the cards where the subject will be',
    );
  });

  describe('automatic capture in the live view', { timeout: 30_000 }, () => {
    // Computed once, because the automatic mode reads the image several times.
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

    it('captures the still image by itself, sets the corners and switches the camera off', async () => {
      const wrapper = await mountAuto(cards);
      expect(wrapper.find('[data-testid="auto-hint"]').exists()).toBe(true);
      await vi.advanceTimersByTimeAsync(2500);
      await flushPromises();
      expect(useCameraStore().still).not.toBeNull();
      expect(useCameraStore().status).toBe('idle');
      expect(useChartStore().ready).toBe(true);
      expect(wrapper.find('[data-testid="auto-hint"]').exists()).toBe(false);
    });

    it('names the image in a band above it: live image, then still image', async () => {
      const wrapper = await mountAuto(cards);
      expect(wrapper.get('[data-testid="stage-label"]').text()).toBe('Livebild');
      await vi.advanceTimersByTimeAsync(2500);
      await flushPromises();
      expect(wrapper.get('[data-testid="stage-label"]').text()).toBe('Standbild');
    });

    it('discards a still image that does not match the corners from the live view', async () => {
      let reads = 0;
      await mountAuto(() => (reads++ < 2 ? cards() : movedData));
      // Two searches (every 500 ms) hit the cards, the third read is the moved still image.
      await vi.advanceTimersByTimeAsync(1200);
      await flushPromises();
      expect(useCameraStore().still).toBeNull();
      expect(useCameraStore().status).toBe('live');
      expect(useChartStore().points).toEqual({});
    });

    it('waits until the cards are held steady', async () => {
      let reads = 0;
      await mountAuto(() => (reads++ < 1 ? cards() : movedData));
      // The first search hits, the second one finds the cards moved: no capture yet.
      await vi.advanceTimersByTimeAsync(1000);
      expect(useCameraStore().still).toBeNull();
      await vi.advanceTimersByTimeAsync(2000);
      await flushPromises();
      expect(useCameraStore().still).not.toBeNull();
      expect(useChartStore().ready).toBe(true);
    });

    it('frames the recognized cards: white while searching, green during the capture', async () => {
      const one = toRgba(oneCardFrame());
      let next: Uint8ClampedArray = empty();
      let reads = 0;
      let duringCapture: string[] = [];
      const wrapper = await mountAuto(() => {
        reads++;
        if (reads === 3) {
          duringCapture = wrapper.find('[data-testid="found-frame"]').classes();
        }
        return next;
      });
      const frame = () => wrapper.find('[data-testid="found-frame"]');
      await vi.advanceTimersByTimeAsync(500);
      expect(frame().exists()).toBe(false);
      next = one;
      await vi.advanceTimersByTimeAsync(500);
      const widthOne = Number(frame().attributes('width'));
      expect(frame().classes()).toContain('animate-frame-pulse');
      next = cards();
      await vi.advanceTimersByTimeAsync(500);
      expect(Number(frame().attributes('width'))).toBeGreaterThan(widthOne);
      expect(frame().classes()).toContain('animate-frame-pulse');
      reads = 0;
      await vi.advanceTimersByTimeAsync(500);
      await flushPromises();
      expect(duringCapture).toContain('animate-frame-draw');
      expect(frame().exists()).toBe(false);
    });

    it('rejects colored cards in the gray step and says so', async () => {
      const colored = twoCardFrame();
      // Fields in red, green and blue (one hue alone would count as a color cast).
      for (let i = 0; i < colored.data.length; i += 3) {
        if (Math.abs(Number(colored.data[i]) - 0.8) < 0.001) {
          const hue = Math.floor(i / 3 / colored.width / 4) % 3;
          colored.data.set(
            hue === 0 ? [0.8, 0.2, 0.2] : hue === 1 ? [0.2, 0.8, 0.2] : [0.2, 0.2, 0.8],
            i,
          );
        }
      }
      const data = toRgba(colored);
      const wrapper = await mountAuto(() => data);
      await vi.advanceTimersByTimeAsync(2500);
      await flushPromises();
      expect(useCameraStore().status).toBe('live');
      expect(useChartStore().ready).toBe(false);
      expect(wrapper.get('[data-testid="wrong-cards"]').text()).toContain('keine Graukarten');
    });

    it('shows the wrong cards as a red frame with a label that goes away with the cards', async () => {
      const colored = twoCardFrame();
      for (let i = 0; i < colored.data.length; i += 3) {
        if (Math.abs(Number(colored.data[i]) - 0.8) < 0.001) {
          const hue = Math.floor(i / 3 / colored.width / 4) % 3;
          colored.data.set(
            hue === 0 ? [0.8, 0.2, 0.2] : hue === 1 ? [0.2, 0.8, 0.2] : [0.2, 0.2, 0.8],
            i,
          );
        }
      }
      const data = toRgba(colored);
      let visible = true;
      const wrapper = await mountAuto(() => (visible ? data : empty()));
      await vi.advanceTimersByTimeAsync(3000);
      await flushPromises();
      expect(wrapper.get('[data-testid="wrong-cards"]').text()).toContain('Keine Graukarten');
      expect(wrapper.get('[data-testid="found-frame"]').attributes('stroke')).toBe('#f87171');
      visible = false;
      await vi.advanceTimersByTimeAsync(1500);
      await flushPromises();
      expect(wrapper.find('[data-testid="wrong-cards"]').exists()).toBe(false);
      visible = true;
      await vi.advanceTimersByTimeAsync(500);
      await flushPromises();
      expect(wrapper.get('[data-testid="found-frame"]').attributes('stroke')).toBe('#fff');
    });

    it('keeps waiting while no cards are visible', async () => {
      await mountAuto(empty);
      await vi.advanceTimersByTimeAsync(5000);
      expect(useCameraStore().still).toBeNull();
      expect(useCameraStore().status).toBe('live');
    });

    it('verlangt zwei Treffer hintereinander', async () => {
      let visible = true;
      await mountAuto(() => (visible ? cards() : empty()));
      await vi.advanceTimersByTimeAsync(500);
      visible = false;
      await vi.advanceTimersByTimeAsync(3000);
      expect(useCameraStore().still).toBeNull();
    });

    it('does not run when the corner points are already set', async () => {
      await mountAuto(cards);
      placeAll();
      await vi.advanceTimersByTimeAsync(4000);
      expect(useCameraStore().still).toBeNull();
    });

    it('delays searching until the video delivers an image', async () => {
      vi.useFakeTimers();
      await mountLive();
      mockGrabberData(cards);
      await vi.advanceTimersByTimeAsync(4000);
      expect(useCameraStore().still).toBeNull();
    });
  });

  it('starts over with “Eckpunkte löschen”: corner points and still image are dropped', async () => {
    const wrapper = await mountLive();
    useCameraStore().still = stillFrame(0.5);
    await flushPromises();
    placeAll();
    await button(wrapper, 'Eckpunkte löschen')?.trigger('click');
    expect(useChartStore().points).toEqual({});
    expect(useCameraStore().still).toBeNull();
    expect(wrapper.findAll('polygon[data-shape]')).toHaveLength(0);
    // The camera is already running: no new start.
    expect(useCameraStore().status).toBe('live');
  });

  it('switches the camera back on with “Eckpunkte löschen” when it is off', async () => {
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

  it('starts over when the resolution changes, not when it is the same or missing', async () => {
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

  it('shows overexposed highlights and underexposed shadows', async () => {
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

  it('stops the measurement on unmount', async () => {
    vi.useFakeTimers();
    const wrapper = await mountLive();
    const measure = vi.spyOn(useChartStore(), 'measure');
    wrapper.unmount();
    await vi.advanceTimersByTimeAsync(1000);
    expect(measure).not.toHaveBeenCalled();
  });
});
