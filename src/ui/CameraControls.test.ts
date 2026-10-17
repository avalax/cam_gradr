import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { useCameraStore } from '../camera/camera-store';
import { installFakeCamera } from '../test-support/media';

import CameraControls from './CameraControls.vue';

describe('CameraControls', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('zeigt Hinweis zur Kamera-Automatik und die Auswahl von Kamera und Auflösung', () => {
    installFakeCamera();
    const wrapper = mount(CameraControls);
    expect(wrapper.get('[role="note"]').text()).toContain('Auto-Belichtung');
    expect(wrapper.findAll('select')).toHaveLength(2);
    expect(wrapper.findAll('button')).toHaveLength(0);
  });

  it('zeigt Geräte und die aktive Auflösung, sobald die Kamera läuft', async () => {
    installFakeCamera();
    const wrapper = mount(CameraControls);
    await useCameraStore().start();
    await flushPromises();
    expect(wrapper.text()).toContain('Aktive Auflösung: 1280 × 720');
    expect(wrapper.text()).toContain('Webcam 2');
  });

  it('wechselt Kamera und Auflösung', async () => {
    const api = installFakeCamera();
    const wrapper = mount(CameraControls);
    await useCameraStore().start();
    await flushPromises();
    const [deviceSelect, resolutionSelect] = wrapper.findAll('select');
    await deviceSelect?.setValue('cam2');
    await flushPromises();
    expect(api.open).toHaveBeenLastCalledWith('cam2', { width: 1280, height: 720 });
    await deviceSelect?.setValue('');
    await flushPromises();
    expect(api.open).toHaveBeenLastCalledWith(null, { width: 1280, height: 720 });
    await resolutionSelect?.setValue('1920x1080');
    await flushPromises();
    expect(api.open).toHaveBeenLastCalledWith(expect.anything(), { width: 1920, height: 1080 });
  });

  it('ignoriert unbekannte Auflösungen', async () => {
    const api = installFakeCamera();
    const wrapper = mount(CameraControls);
    const select = wrapper.findAll('select')[1];
    const option = document.createElement('option');
    option.value = '1x1';
    select?.element.append(option);
    await select?.setValue('1x1');
    expect(api.open).not.toHaveBeenCalled();
  });
});
