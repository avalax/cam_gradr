import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { installFakeCamera } from '../test-support/media';

import CameraControls from './CameraControls.vue';

function button(wrapper: ReturnType<typeof mount>, text: string) {
  return wrapper.findAll('button').find((b) => b.text().includes(text));
}

describe('CameraControls', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('zeigt Hinweis zur Kamera-Automatik und den Start-Knopf', () => {
    installFakeCamera();
    const wrapper = mount(CameraControls);
    expect(wrapper.get('[role="note"]').text()).toContain('Auto-Belichtung');
    expect(wrapper.text()).toContain('Kamera starten');
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it('startet und stoppt die Kamera und zeigt die aktive Auflösung', async () => {
    const api = installFakeCamera();
    const wrapper = mount(CameraControls);
    await button(wrapper, 'Kamera starten')?.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Aktive Auflösung: 1280 × 720');
    expect(wrapper.text()).toContain('Webcam 2');
    await button(wrapper, 'Kamera stoppen')?.trigger('click');
    expect(api.close).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('Kamera starten');
  });

  it('zeigt Fehlermeldungen an', async () => {
    installFakeCamera({ open: () => Promise.reject(new Error('x')) });
    const wrapper = mount(CameraControls);
    await button(wrapper, 'Kamera starten')?.trigger('click');
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('nicht gestartet');
  });

  it('wechselt Kamera und Auflösung', async () => {
    const api = installFakeCamera();
    const wrapper = mount(CameraControls);
    await button(wrapper, 'Kamera starten')?.trigger('click');
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
