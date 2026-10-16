import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCameraStore } from '../camera/camera-store';
import { useChartStore } from '../chart/chart-store';
import { FAKE_STREAM, installFakeCamera, installMediaStubs } from '../test-support/media';

import GrayStep from './GrayStep.vue';

function mockCanvas(value: number) {
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
  return wrapper;
}

async function clickAt(wrapper: Awaited<ReturnType<typeof mountLive>>, x: number, y: number) {
  await wrapper.get('svg').trigger('click', { clientX: x, clientY: y });
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
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('warnt, wenn die Kamera nicht läuft, und nennt den ersten Eckpunkt', () => {
    installFakeCamera();
    const wrapper = mount(GrayStep);
    expect(wrapper.get('[role="alert"]').text()).toContain('Kamera läuft nicht');
    expect(wrapper.text()).toContain('oben links der linke Graukarte (50 %)');
    expect(wrapper.text()).toContain('Noch keine Messung');
  });

  it('verbindet den laufenden Stream mit dem Video', async () => {
    const wrapper = await mountLive();
    expect(wrapper.get('video').element.srcObject).toBe(FAKE_STREAM);
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it('bindet einen bereits laufenden Stream beim Einhängen an', async () => {
    installFakeCamera();
    await useCameraStore().start();
    const wrapper = mount(GrayStep);
    expect(wrapper.get('video').element.srcObject).toBe(FAKE_STREAM);
  });

  it('setzt Eckpunkte per Klick in Bildkoordinaten', async () => {
    const wrapper = await mountLive();
    await clickAt(wrapper, 640, 360);
    expect(useChartStore().points[3]).toEqual([{ x: 640, y: 360 }]);
    expect(wrapper.findAll('circle')).toHaveLength(1);
    expect(wrapper.text()).toContain('oben rechts');
  });

  it('verschiebt einen Eckpunkt per Ziehen und beendet das Ziehen', async () => {
    const wrapper = await mountLive();
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

  it('setzt beim Klick auf einen Eckpunkt keinen neuen', async () => {
    const wrapper = await mountLive();
    await clickAt(wrapper, 100, 100);
    await wrapper.get('circle').trigger('click');
    expect(useChartStore().points[3]).toHaveLength(1);
  });

  it('zeichnet Umrisse, sobald eine Karte vollständig ist, und setzt per Knopf zurück', async () => {
    const wrapper = await mountLive();
    for (const [x, y] of [
      [100, 100],
      [500, 100],
      [500, 600],
      [100, 600],
    ] as const) {
      await clickAt(wrapper, x, y);
    }
    expect(wrapper.findAll('polygon').length).toBeGreaterThan(5);
    await wrapper.findAll('button')[0]?.trigger('click');
    expect(wrapper.findAll('polygon')).toHaveLength(0);
    expect(useChartStore().points).toEqual({});
  });

  it('misst im Takt, zeigt die Ampel und aktiviert „Weiter“ nur bei grün', async () => {
    vi.useFakeTimers();
    mockCanvas(190);
    const wrapper = await mountLive();
    const chart = useChartStore();
    for (const [x, y] of [
      [100, 50],
      [500, 50],
      [500, 650],
      [100, 650],
      [700, 50],
      [1100, 50],
      [1100, 650],
      [700, 650],
    ] as const) {
      await clickAt(wrapper, x, y);
    }
    expect(chart.ready).toBe(true);
    await vi.advanceTimersByTimeAsync(300);
    expect(chart.exposure).not.toBeNull();
    expect(wrapper.find('[data-testid="badge"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('18 %-Feld');
    const next = wrapper.findAll('button').find((b) => b.text().includes('Weiter'));
    const verdict = chart.exposure?.verdict;
    expect(next?.attributes('disabled') !== undefined).toBe(verdict !== 'ok');
  });

  it('meldet „continue“, wenn die Belichtung ok ist', async () => {
    const wrapper = await mountLive();
    useChartStore().exposure = {
      verdict: 'ok',
      highlightsClipped: false,
      shadowsCrushed: false,
      level18: 0.46,
      level50: 0.74,
      delta: 0,
    };
    await flushPromises();
    const next = wrapper.findAll('button').find((b) => b.text().includes('Weiter'));
    expect(next?.attributes('disabled')).toBeUndefined();
    await next?.trigger('click');
    expect(wrapper.emitted('continue')).toHaveLength(1);
    expect(wrapper.text()).toContain('Lichter');
    expect(wrapper.text()).toContain('ok');
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
    const chart = useChartStore();
    const measure = vi.spyOn(chart, 'measure');
    wrapper.unmount();
    await vi.advanceTimersByTimeAsync(1000);
    expect(measure).not.toHaveBeenCalled();
  });
});
