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

  it('zeigt Namen, Kennung, den Kameraschalter und zunächst den Tab Graukarten', () => {
    installFakeCamera();
    const wrapper = mountApp();
    expect(wrapper.get('h1').text()).toBe(APP_NAME);
    expect(wrapper.get('[data-testid="camera-toggle"]').text()).toBe('Kamera starten');
    expect(wrapper.text()).toContain('Dieser Tab stellt die Raumhelligkeit ein');
    expect(wrapper.get('footer').text()).toContain(APP_ID);
    expect(APP_ID).toBe('avalax.cam_gradr');
  });

  it('nennt unter Graukarten und Farbkarten noch kein Ergebnis und zeigt leere Skalen', () => {
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

  it('zeigt das Ergebnis im Tab: Licht passt, aber die Farben haben noch eine hohe Abweichung', async () => {
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

  it('gibt dem Export die Höhe der anderen Tabs als Mindesthöhe', async () => {
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
    // Im Export gemessene Höhen zählen nicht.
    observers[0]?.fire(300);
    await flushPromises();
    expect(panel().attributes('style')).toContain('min-height: 480px');
    await tabs(wrapper)[0]?.trigger('click');
    expect(panel().attributes('style')).toBeUndefined();
    wrapper.unmount();
  });

  it('bietet vier Tabs, die alle frei anwählbar sind', () => {
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

  it('schaltet die Kamera über den Schalter neben den Tabs, ohne den Tab zu wechseln', async () => {
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

  it('bietet die Kameraeinstellungen im Zahnrad-Menü an', async () => {
    installFakeCamera();
    const wrapper = mountApp();
    expect(wrapper.text()).not.toContain('Auto-Belichtung');
    await wrapper.get('[data-testid="settings-button"]').trigger('click');
    expect(wrapper.get('[role="note"]').text()).toContain('Auto-Belichtung');
    expect(wrapper.text()).toContain('Auflösung');
  });

  it('hält die Kamera beim Wechsel der Tabs am Laufen', async () => {
    const api = installFakeCamera();
    const wrapper = mountApp();
    await useCameraStore().start();
    await tabs(wrapper)[1]?.trigger('click');
    await tabs(wrapper)[2]?.trigger('click');
    expect(api.close).not.toHaveBeenCalled();
    expect(useCameraStore().status).toBe('live');
  });

  it('gibt jedem Tab mit Kamerabild sein eigenes Standbild, der Export ändert nichts', async () => {
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

  it('zeigt im Tab Export den Hinweis auf die fehlende Farbkorrektur und springt zu den Farbkarten', async () => {
    installFakeCamera();
    const wrapper = mountApp();
    await tabs(wrapper)[3]?.trigger('click');
    expect(wrapper.find('[data-testid="export-no-model"]').exists()).toBe(true);
    await wrapper.get('[data-testid="export-no-model"] button').trigger('click');
    expect(tabs(wrapper)[1]?.attributes('aria-selected')).toBe('true');
  });

  it('bietet Referenzwerte im Zahnrad-Menü und das Projekt im Tab Export an', async () => {
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

  it('lädt beim Start den mitgelieferten Referenzsatz', async () => {
    installFakeCamera();
    mountApp();
    await flushPromises();
    expect(useReferenceStore().selected?.name).toBe(BUNDLED_NAME);
  });

  it('zeigt im Tab Vorschau den Hinweis auf die fehlende Farbkorrektur', async () => {
    installFakeCamera();
    const wrapper = mountApp();
    await tabs(wrapper)[2]?.trigger('click');
    expect(wrapper.text()).toContain('Noch keine Farbkorrektur');
  });

  it('stoppt die Kamera beim Entfernen der App', async () => {
    const api = installFakeCamera();
    const wrapper = mountApp();
    await useCameraStore().start();
    wrapper.unmount();
    expect(api.close).toHaveBeenCalledTimes(1);
  });
});
