import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import App from './App.vue';
import { useCameraStore } from './camera/camera-store';
import { useChartStore } from './chart/chart-store';
import { BUNDLED_NAME } from './reference/bundled';
import { useReferenceStore } from './reference/reference-store';
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

  it('zeigt Namen, Kennung, den Kameraschalter und zunächst den Tab Graukarten', () => {
    installFakeCamera();
    const wrapper = mountApp();
    expect(wrapper.get('h1').text()).toBe(APP_NAME);
    expect(wrapper.get('[data-testid="camera-toggle"]').text()).toBe('Kamera starten');
    expect(wrapper.text()).toContain('Dieser Tab stellt die Raumhelligkeit ein');
    expect(wrapper.get('footer').text()).toBe(APP_ID);
    expect(APP_ID).toBe('avalax.cam_gradr');
  });

  it('bietet vier Tabs, die alle frei anwählbar sind', () => {
    installFakeCamera();
    const wrapper = mountApp();
    const all = tabs(wrapper);
    expect(all.map((tab) => tab.text())).toEqual([
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

  it('wechselt mit „Weiter“ zu den Farbkarten', async () => {
    installFakeCamera();
    const wrapper = mountApp();
    useChartStore().exposure = {
      verdict: 'ok',
      highlightsClipped: false,
      shadowsCrushed: false,
      level18: 0.46,
      level50: 0.74,
      delta: 0,
    };
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Weiter'))
      ?.trigger('click');
    expect(tabs(wrapper)[1]?.attributes('aria-selected')).toBe('true');
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

  it('behält das Standbild beim Wechsel zu Vorschau und Export, verwirft es aber zwischen Grau und Farbe', async () => {
    installFakeCamera();
    const wrapper = mountApp();
    const camera = useCameraStore();
    camera.still = stillFrame();
    await tabs(wrapper)[0]?.trigger('click');
    expect(camera.still).not.toBeNull();
    await tabs(wrapper)[2]?.trigger('click');
    expect(camera.still).not.toBeNull();
    await tabs(wrapper)[3]?.trigger('click');
    expect(camera.still).not.toBeNull();
    await tabs(wrapper)[0]?.trigger('click');
    expect(camera.still).not.toBeNull();
    await tabs(wrapper)[1]?.trigger('click');
    expect(camera.still).toBeNull();
  });

  it('zeigt im Tab Export den Hinweis auf die fehlende Farbkorrektur', async () => {
    installFakeCamera();
    const wrapper = mountApp();
    await tabs(wrapper)[3]?.trigger('click');
    expect(wrapper.find('[data-testid="export-no-model"]').exists()).toBe(true);
  });

  it('bietet Referenzwerte und Projekt im Zahnrad-Menü rechts oben an', async () => {
    installFakeCamera();
    const wrapper = mountApp();
    expect(wrapper.find('[data-testid="project-save"]').exists()).toBe(false);
    await wrapper.get('[data-testid="settings-button"]').trigger('click');
    expect(wrapper.find('[data-testid="project-save"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="project-file"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="reference-select"]').exists()).toBe(true);
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
    expect(wrapper.text()).toContain('Es gibt noch keine Farbkorrektur');
  });

  it('stoppt die Kamera beim Entfernen der App', async () => {
    const api = installFakeCamera();
    const wrapper = mountApp();
    await useCameraStore().start();
    wrapper.unmount();
    expect(api.close).toHaveBeenCalledTimes(1);
  });
});
