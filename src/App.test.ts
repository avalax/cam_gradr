import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import App from './App.vue';
import { useCameraStore } from './camera/camera-store';
import { useChartStore } from './chart/chart-store';
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

  it('zeigt Namen, Kennung und zunächst den Kamera-Tab', () => {
    installFakeCamera();
    const wrapper = mountApp();
    expect(wrapper.get('h1').text()).toBe(APP_NAME);
    expect(wrapper.text()).toContain('Kamera an');
    expect(wrapper.get('footer').text()).toBe(APP_ID);
    expect(APP_ID).toBe('avalax.cam_gradr');
  });

  it('bietet drei Tabs, die alle frei anwählbar sind', () => {
    installFakeCamera();
    const wrapper = mountApp();
    const all = tabs(wrapper);
    expect(all.map((tab) => tab.text())).toEqual(['Kamera', 'Graukarten', 'Farbkarten']);
    expect(all.map((tab) => tab.attributes('aria-selected'))).toEqual(['true', 'false', 'false']);
    for (const tab of all) {
      expect(tab.attributes('disabled')).toBeUndefined();
    }
    expect(wrapper.find('[role="tablist"]').exists()).toBe(true);
    expect(wrapper.get('[role="tabpanel"]').attributes('aria-labelledby')).toBe('tab-camera');
  });

  it('wechselt ohne Bedingungen zwischen den Tabs', async () => {
    installFakeCamera();
    const wrapper = mountApp();
    await tabs(wrapper)[2]?.trigger('click');
    expect(wrapper.text()).toContain('Dieser Tab berechnet die Farbkorrektur');
    expect(tabs(wrapper)[2]?.attributes('aria-selected')).toBe('true');
    await tabs(wrapper)[1]?.trigger('click');
    expect(wrapper.text()).toContain('Dieser Tab stellt die Raumhelligkeit ein');
    await tabs(wrapper)[0]?.trigger('click');
    expect(wrapper.text()).toContain('Kamera an');
  });

  it('wechselt mit „Weiter“ zu den Farbkarten', async () => {
    installFakeCamera();
    const wrapper = mountApp();
    await tabs(wrapper)[1]?.trigger('click');
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
    expect(tabs(wrapper)[2]?.attributes('aria-selected')).toBe('true');
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

  it('behält das Standbild zwischen Kamera- und Kartentab, verwirft es aber zwischen Grau und Farbe', async () => {
    installFakeCamera();
    const wrapper = mountApp();
    const camera = useCameraStore();
    camera.still = stillFrame();
    await tabs(wrapper)[1]?.trigger('click');
    expect(camera.still).not.toBeNull();
    await tabs(wrapper)[0]?.trigger('click');
    expect(camera.still).not.toBeNull();
    await tabs(wrapper)[2]?.trigger('click');
    expect(camera.still).not.toBeNull();
    await tabs(wrapper)[1]?.trigger('click');
    expect(camera.still).toBeNull();
  });

  it('stoppt die Kamera beim Entfernen der App', async () => {
    const api = installFakeCamera();
    const wrapper = mountApp();
    await useCameraStore().start();
    wrapper.unmount();
    expect(api.close).toHaveBeenCalledTimes(1);
  });
});
