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

function approve() {
  useChartStore().exposure = {
    verdict: 'ok',
    highlightsClipped: false,
    shadowsCrushed: false,
    level18: 0.46,
    level50: 0.74,
    delta: 0,
  };
}

describe('App', () => {
  beforeEach(() => {
    installMediaStubs();
  });

  it('zeigt Namen, Kennung und Schritt 1 mit Kamerasteuerung', () => {
    installFakeCamera();
    const wrapper = mountApp();
    expect(wrapper.get('h1').text()).toBe(APP_NAME);
    expect(wrapper.text()).toContain('Kamera starten');
    expect(wrapper.text()).toContain('Standbild');
    expect(wrapper.get('footer').text()).toBe(APP_ID);
    expect(APP_ID).toBe('avalax.cam_gradr');
  });

  it('sperrt Schritt 2, bis Schritt 1 abgeschlossen ist', () => {
    installFakeCamera();
    const wrapper = mountApp();
    const [stepOne, stepTwo] = wrapper.findAll('nav button');
    expect(stepOne?.attributes('aria-current')).toBe('step');
    expect(stepTwo?.attributes('disabled')).toBeDefined();
    expect(stepTwo?.attributes('aria-current')).toBeUndefined();
  });

  it('wechselt nach „Weiter“ zu Schritt 2 und wieder zurück', async () => {
    installFakeCamera();
    const wrapper = mountApp();
    approve();
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Weiter'))
      ?.trigger('click');
    const [stepOne, stepTwo] = wrapper.findAll('nav button');
    expect(wrapper.text()).toContain('Schritt 2 (Farbkarten');
    expect(stepTwo?.attributes('aria-current')).toBe('step');
    expect(stepTwo?.attributes('disabled')).toBeUndefined();
    await stepOne?.trigger('click');
    expect(wrapper.text()).toContain('Kamera starten');
    await stepTwo?.trigger('click');
    expect(wrapper.text()).toContain('Schritt 2 (Farbkarten');
  });

  it('hält die Kamera beim Wechsel der Schritte am Laufen', async () => {
    const api = installFakeCamera();
    const wrapper = mountApp();
    await useCameraStore().start();
    approve();
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Weiter'))
      ?.trigger('click');
    expect(api.close).not.toHaveBeenCalled();
    expect(useCameraStore().status).toBe('live');
  });

  it('stoppt die Kamera beim Entfernen der App', async () => {
    const api = installFakeCamera();
    const wrapper = mountApp();
    await useCameraStore().start();
    wrapper.unmount();
    expect(api.close).toHaveBeenCalledTimes(1);
  });
});
