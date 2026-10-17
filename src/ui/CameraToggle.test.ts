import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { useCameraStore } from '../camera/camera-store';
import { installFakeCamera } from '../test-support/media';

import CameraToggle from './CameraToggle.vue';

function toggle(wrapper: ReturnType<typeof mount>) {
  return wrapper.get('[data-testid="camera-toggle"]');
}

describe('CameraToggle', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('startet ausgeschaltet', () => {
    installFakeCamera();
    const wrapper = mount(CameraToggle);
    expect(toggle(wrapper).text()).toBe('Kamera starten');
    expect(toggle(wrapper).attributes('role')).toBe('switch');
    expect(toggle(wrapper).attributes('aria-checked')).toBe('false');
    expect(toggle(wrapper).classes()).toContain('bg-emerald-700');
    expect(toggle(wrapper).attributes('aria-label')).toBe('Kamera');
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it('schaltet die Kamera an und wieder aus', async () => {
    const api = installFakeCamera();
    const wrapper = mount(CameraToggle);
    await toggle(wrapper).trigger('click');
    await flushPromises();
    expect(api.open).toHaveBeenCalledTimes(1);
    expect(toggle(wrapper).text()).toBe('Kamera stoppen');
    expect(toggle(wrapper).classes()).toContain('bg-red-700');
    expect(toggle(wrapper).attributes('aria-checked')).toBe('true');
    expect(toggle(wrapper).attributes('data-status')).toBe('live');
    await toggle(wrapper).trigger('click');
    expect(api.close).toHaveBeenCalledTimes(1);
    expect(toggle(wrapper).text()).toBe('Kamera starten');
    expect(toggle(wrapper).attributes('data-status')).toBe('idle');
  });

  it('zeigt das Starten an', async () => {
    installFakeCamera();
    const wrapper = mount(CameraToggle);
    const starting = useCameraStore().start();
    await wrapper.vm.$nextTick();
    expect(toggle(wrapper).text()).toBe('Kamera startet …');
    expect(toggle(wrapper).classes()).toContain('bg-amber-400');
    expect(toggle(wrapper).attributes('aria-checked')).toBe('true');
    await starting;
  });

  it('zeigt Fehler beim Starten und lässt sich dann ausschalten', async () => {
    installFakeCamera({ open: () => Promise.reject(new Error('x')) });
    const wrapper = mount(CameraToggle);
    await toggle(wrapper).trigger('click');
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('nicht gestartet');
    expect(toggle(wrapper).attributes('data-status')).toBe('error');
    await toggle(wrapper).trigger('click');
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(toggle(wrapper).text()).toBe('Kamera starten');
  });
});
