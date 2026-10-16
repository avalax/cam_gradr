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

describe('App', () => {
  beforeEach(() => {
    installMediaStubs();
  });

  it('zeigt Namen, Kennung und zunächst das Kamera-Panel', () => {
    installFakeCamera();
    const wrapper = mountApp();
    expect(wrapper.get('h1').text()).toBe(APP_NAME);
    expect(wrapper.text()).toContain('Kamera starten');
    expect(wrapper.get('footer').text()).toBe(APP_ID);
    expect(APP_ID).toBe('avalax.cam_gradr');
  });

  it('wechselt zwischen den Schritten und markiert den aktuellen', async () => {
    installFakeCamera();
    const wrapper = mountApp();
    const [cameraTab, grayTab] = wrapper.findAll('nav button');
    expect(cameraTab?.attributes('aria-current')).toBe('step');
    await grayTab?.trigger('click');
    expect(wrapper.text()).toContain('Beide Graukarten gemeinsam');
    expect(grayTab?.attributes('aria-current')).toBe('step');
    expect(cameraTab?.attributes('aria-current')).toBeUndefined();
    await cameraTab?.trigger('click');
    expect(wrapper.text()).toContain('Kamera starten');
  });

  it('hält die Kamera beim Wechsel der Schritte am Laufen', async () => {
    const api = installFakeCamera();
    const wrapper = mountApp();
    await useCameraStore().start();
    await wrapper.findAll('nav button')[1]?.trigger('click');
    await flushPromises();
    expect(api.close).not.toHaveBeenCalled();
    expect(useCameraStore().status).toBe('live');
  });

  it('kehrt nach „Weiter“ zum Kamera-Schritt zurück', async () => {
    installFakeCamera();
    const wrapper = mountApp();
    await wrapper.findAll('nav button')[1]?.trigger('click');
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
    await next?.trigger('click');
    expect(wrapper.text()).toContain('Kamera starten');
  });

  it('stoppt die Kamera beim Entfernen der App', async () => {
    const api = installFakeCamera();
    const wrapper = mountApp();
    await useCameraStore().start();
    wrapper.unmount();
    expect(api.close).toHaveBeenCalledTimes(1);
  });
});
