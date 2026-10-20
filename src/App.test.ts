import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from './App.vue';
import { useCameraStore } from './camera/camera-store';
import { useChartStore } from './chart/chart-store';
import { BUNDLED_NAME } from './reference/bundled';
import { useReferenceStore } from './reference/reference-store';
import { useSolveStore } from './solve/solve-store';
import { installFakeCamera, installMediaStubs } from './test-support/media';
import { APP_ID, APP_NAME } from './ui/app-info';

function mountApp() {
  const pinia = createPinia();
  setActivePinia(pinia);
  return mount(App, { global: { plugins: [pinia] } });
}

function tabs(wrapper: ReturnType<typeof mountApp>) {
  return wrapper.findAll('[role="tab"]');
}

function stillFrame() {
  return { width: 4, height: 3, data: new Float32Array(4 * 3 * 3) };
}

describe('App', () => {
  beforeEach(() => {
    installMediaStubs();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows name, identifier, the camera toggle and initially the gray cards tab', () => {
    installFakeCamera();
    const wrapper = mountApp();
    expect(wrapper.get('h1').text()).toBe(APP_NAME);
    expect(wrapper.get('[data-testid="camera-toggle"]').text()).toBe('Kamera starten');
    expect(wrapper.text()).toContain('Dieser Tab stellt die Raumhelligkeit ein');
    expect(wrapper.get('footer').text()).toContain(APP_ID);
    expect(APP_ID).toBe('avalax.cam_gradr');
  });

  it('shows no result yet under gray cards and color cards and displays empty scales', () => {
    installFakeCamera();
    const wrapper = mountApp();
    const [gray, color, preview, exportTab] = tabs(wrapper);
    expect(gray?.text()).toContain('Noch nicht gemessen');
    expect(color?.text()).toContain('Noch nicht berechnet');
    expect(preview?.text()).toContain('Original / korrigiert');
    expect(exportTab?.text()).toContain('.cube, Projekt');
    const gauges = wrapper.findAll('[data-testid="status-gauge"]');
    expect(gauges.map((gauge) => gauge.attributes('data-level'))).toEqual(['off', 'off']);
    expect(wrapper.findAll('[data-filled="true"]')).toHaveLength(0);
    expect(gray?.attributes('aria-describedby')).toBe('tab-hint-gray');
  });

  it('shows the result in the tab: light is fine, but the colors still have a high deviation', async () => {
    installFakeCamera();
    const wrapper = mountApp();
    useChartStore().exposure = {
      verdict: 'ok',
      highlightsClipped: false,
      shadowsCrushed: false,
      level18: 0.46,
      level50: 0.74,
      delta: 0,
      contrast: 0,
    };
    useSolveStore().result = {
      model: {} as never,
      report: { meanBefore: 20.2, meanAfter: 8 },
    } as never;
    await flushPromises();
    const [gray, color] = tabs(wrapper);
    expect(gray?.text()).toContain('Licht passt');
    expect(color?.text()).toContain('Ø 20,2 → 8,0');
    const gauges = wrapper.findAll('[data-testid="status-gauge"]');
    expect(gauges.map((gauge) => gauge.attributes('data-level'))).toEqual(['ok', 'warn']);
    expect(gauges[0]?.findAll('[data-filled="true"]')).toHaveLength(4);
    expect(gauges[1]?.findAll('[data-filled="true"]')).toHaveLength(2);
  });

  it('gives the export the height of the other tabs as its minimum height', async () => {
    const observers: { fire: (height: number) => void }[] = [];
    class FakeObserver {
      readonly observe = vi.fn();
      readonly disconnect = vi.fn();
      constructor(private readonly callback: ResizeObserverCallback) {
        observers.push({
          fire: (height) => {
            const target = { getBoundingClientRect: () => ({ height }) };
            this.callback([{ target } as unknown as ResizeObserverEntry], this as never);
          },
        });
      }
    }
    vi.stubGlobal('ResizeObserver', FakeObserver);
    installFakeCamera();
    const wrapper = mountApp();
    const panel = () => wrapper.get('[role="tabpanel"]');
    expect(panel().attributes('style')).toBeUndefined();
    observers[0]?.fire(480);
    await flushPromises();
    await tabs(wrapper)[3]?.trigger('click');
    expect(panel().attributes('style')).toContain('min-height: 480px');
    // Heights measured in the export do not count.
    observers[0]?.fire(300);
    await flushPromises();
    expect(panel().attributes('style')).toContain('min-height: 480px');
    await tabs(wrapper)[0]?.trigger('click');
    expect(panel().attributes('style')).toBeUndefined();
    wrapper.unmount();
  });

  it('offers four tabs, all freely selectable', () => {
    installFakeCamera();
    const wrapper = mountApp();
    const all = tabs(wrapper);
    expect(all.map((tab) => tab.attributes('aria-label'))).toEqual([
      'Graukarten',
      'Farbkarten',
      'Vorschau',
      'Export',
    ]);
    expect(all.map((tab) => tab.attributes('aria-selected'))).toEqual([
      'true',
      'false',
      'false',
      'false',
    ]);
    for (const tab of all) {
      expect(tab.attributes('disabled')).toBeUndefined();
    }
    expect(wrapper.find('[role="tablist"]').exists()).toBe(true);
    expect(wrapper.get('[role="tabpanel"]').attributes('aria-labelledby')).toBe('tab-gray');
  });

  it('wechselt ohne Bedingungen zwischen den Tabs', async () => {
    installFakeCamera();
    const wrapper = mountApp();
    await tabs(wrapper)[1]?.trigger('click');
    expect(wrapper.text()).toContain('Dieser Tab berechnet die Farbkorrektur');
    expect(tabs(wrapper)[1]?.attributes('aria-selected')).toBe('true');
    await tabs(wrapper)[0]?.trigger('click');
    expect(wrapper.text()).toContain('Dieser Tab stellt die Raumhelligkeit ein');
  });

  it('toggles the camera via the switch next to the tabs without changing the tab', async () => {
    const api = installFakeCamera();
    const wrapper = mountApp();
    await tabs(wrapper)[2]?.trigger('click');
    await wrapper.get('[data-testid="camera-toggle"]').trigger('click');
    await flushPromises();
    expect(api.open).toHaveBeenCalledTimes(1);
    expect(useCameraStore().status).toBe('live');
    expect(tabs(wrapper)[2]?.attributes('aria-selected')).toBe('true');
    await wrapper.get('[data-testid="camera-toggle"]').trigger('click');
    expect(api.close).toHaveBeenCalledTimes(1);
    expect(tabs(wrapper)[2]?.attributes('aria-selected')).toBe('true');
  });

  it('offers the camera settings in the gear menu', async () => {
    installFakeCamera();
    const wrapper = mountApp();
    expect(wrapper.text()).not.toContain('Auto-Belichtung');
    await wrapper.get('[data-testid="settings-button"]').trigger('click');
    expect(wrapper.get('[role="note"]').text()).toContain('Auto-Belichtung');
    expect(wrapper.text()).toContain('Auflösung');
  });

  it('keeps the camera running when switching tabs', async () => {
    const api = installFakeCamera();
    const wrapper = mountApp();
    await useCameraStore().start();
    await tabs(wrapper)[1]?.trigger('click');
    await tabs(wrapper)[2]?.trigger('click');
    expect(api.close).not.toHaveBeenCalled();
    expect(useCameraStore().status).toBe('live');
  });

  it('gives each tab with a camera image its own still image, the export changes nothing', async () => {
    installFakeCamera();
    const wrapper = mountApp();
    const camera = useCameraStore();
    const gray = stillFrame();
    camera.still = gray;
    await tabs(wrapper)[0]?.trigger('click');
    expect(camera.still).toBe(gray);
    await tabs(wrapper)[1]?.trigger('click');
    expect(camera.still).toBeNull();
    await tabs(wrapper)[2]?.trigger('click');
    expect(camera.still).toBeNull();
    await tabs(wrapper)[3]?.trigger('click');
    expect(camera.still).toBeNull();
    await tabs(wrapper)[0]?.trigger('click');
    expect(camera.still).toBe(gray);
  });

  it('shows the missing-color-correction notice in the export tab and jumps to the color cards', async () => {
    installFakeCamera();
    const wrapper = mountApp();
    await tabs(wrapper)[3]?.trigger('click');
    expect(wrapper.find('[data-testid="export-no-model"]').exists()).toBe(true);
    await wrapper.get('[data-testid="export-no-model"] button').trigger('click');
    expect(tabs(wrapper)[1]?.attributes('aria-selected')).toBe('true');
  });

  it('offers reference values in the gear menu and the project in the export tab', async () => {
    installFakeCamera();
    const wrapper = mountApp();
    expect(wrapper.find('[data-testid="project-save"]').exists()).toBe(false);
    await wrapper.get('[data-testid="settings-button"]').trigger('click');
    await wrapper.get('[data-testid="section-reference"]').trigger('click');
    expect(wrapper.find('[data-testid="reference-select"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="project-save"]').exists()).toBe(false);
    await tabs(wrapper)[3]?.trigger('click');
    expect(wrapper.find('[data-testid="project-save"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="project-file"]').exists()).toBe(true);
  });

  it('loads the bundled reference set at startup', async () => {
    installFakeCamera();
    mountApp();
    await flushPromises();
    expect(useReferenceStore().selected?.name).toBe(BUNDLED_NAME);
  });

  it('shows the missing-color-correction notice in the preview tab', async () => {
    installFakeCamera();
    const wrapper = mountApp();
    await tabs(wrapper)[2]?.trigger('click');
    expect(wrapper.text()).toContain('Noch keine Farbkorrektur');
  });

  it('stops the camera when the app is removed', async () => {
    const api = installFakeCamera();
    const wrapper = mountApp();
    await useCameraStore().start();
    wrapper.unmount();
    expect(api.close).toHaveBeenCalledTimes(1);
  });
});
