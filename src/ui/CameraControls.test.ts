import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { useCameraStore } from '../camera/camera-store';
import { RESOLUTIONS } from '../camera/types';
import { installFakeCamera } from '../test-support/media';

import CameraControls from './CameraControls.vue';

describe('CameraControls', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('shows the camera automation hint and the camera and resolution choice', () => {
    installFakeCamera();
    const wrapper = mount(CameraControls);
    expect(wrapper.get('[role="note"]').text()).toContain('Auto-Belichtung');
    expect(wrapper.findAll('select')).toHaveLength(1);
    expect(wrapper.findAll('[role="radio"]')).toHaveLength(RESOLUTIONS.length);
    expect(wrapper.get('[data-resolution="1280x720"]').attributes('aria-checked')).toBe('true');
    expect(wrapper.get('[data-resolution="640x480"]').attributes('aria-checked')).toBe('false');
  });

  it('locks the selection while the camera is starting', async () => {
    installFakeCamera();
    const wrapper = mount(CameraControls);
    const start = useCameraStore().start();
    await flushPromises();
    await start;
    expect(wrapper.get('[data-resolution="640x480"]').attributes('disabled')).toBeUndefined();
    useCameraStore().status = 'starting';
    await flushPromises();
    expect(wrapper.get('[data-resolution="640x480"]').attributes('disabled')).toBeDefined();
    expect(wrapper.get('select').attributes('disabled')).toBeDefined();
  });

  it('shows devices and the active resolution once the camera is running', async () => {
    installFakeCamera();
    const wrapper = mount(CameraControls);
    await useCameraStore().start();
    await flushPromises();
    expect(wrapper.text()).toContain('Aktive Auflösung: 1280 × 720');
    expect(wrapper.text()).toContain('Webcam 2');
  });

  it('switches camera and resolution', async () => {
    const api = installFakeCamera();
    const wrapper = mount(CameraControls);
    await useCameraStore().start();
    await flushPromises();
    const deviceSelect = wrapper.get('select');
    await deviceSelect.setValue('cam2');
    await flushPromises();
    expect(api.open).toHaveBeenLastCalledWith('cam2', { width: 1280, height: 720 });
    await deviceSelect.setValue('');
    await flushPromises();
    expect(api.open).toHaveBeenLastCalledWith(null, { width: 1280, height: 720 });
    await wrapper.get('[data-resolution="1920x1080"]').trigger('click');
    await flushPromises();
    expect(api.open).toHaveBeenLastCalledWith(expect.anything(), { width: 1920, height: 1080 });
  });
});
