import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCameraStore } from '../camera/camera-store';

import SettingsMenu from './SettingsMenu.vue';

const download = vi.hoisted(() => vi.fn());
vi.mock('../lut/download', () => ({ downloadFile: download }));

function panel(wrapper: ReturnType<typeof mount>) {
  return wrapper.find('[data-testid="settings-panel"]');
}

describe('SettingsMenu', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  function mountAttached() {
    return mount(SettingsMenu, { attachTo: document.body });
  }

  it('zeigt zunächst nur das Zahnrad', () => {
    const wrapper = mountAttached();
    const gear = wrapper.get('[data-testid="settings-button"]');
    expect(gear.attributes('aria-label')).toBe('Einstellungen');
    expect(gear.attributes('aria-expanded')).toBe('false');
    expect(panel(wrapper).exists()).toBe(false);
    wrapper.unmount();
  });

  it('öffnet und schließt das Menü mit dem Zahnrad und zeigt Referenzen und Kamera', async () => {
    const wrapper = mountAttached();
    await wrapper.get('[data-testid="settings-button"]').trigger('click');
    expect(panel(wrapper).exists()).toBe(true);
    expect(wrapper.get('[data-testid="settings-button"]').attributes('aria-expanded')).toBe('true');
    expect(wrapper.text()).toContain('Referenzwerte');
    expect(wrapper.text()).toContain('Auto-Belichtung');
    expect(wrapper.find('[data-testid="project-save"]').exists()).toBe(false);
    await wrapper.get('[data-testid="settings-button"]').trigger('click');
    expect(panel(wrapper).exists()).toBe(false);
    wrapper.unmount();
  });

  it('klappt zuerst die Kamera auf und zeigt zugeklappt eine Kurzfassung', async () => {
    const wrapper = mountAttached();
    await wrapper.get('[data-testid="settings-button"]').trigger('click');
    const camera = wrapper.get('[data-testid="section-camera"]');
    const reference = wrapper.get('[data-testid="section-reference"]');
    expect(camera.attributes('aria-expanded')).toBe('true');
    expect(reference.attributes('aria-expanded')).toBe('false');
    expect(camera.text()).toContain('Standardkamera · 1280 × 720');
    expect(reference.text()).toContain('Mitgelieferter Satz');
    expect(wrapper.find('[data-testid="reference-select"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('wechselt zwischen den Abschnitten und klappt den offenen wieder zu', async () => {
    const wrapper = mountAttached();
    await wrapper.get('[data-testid="settings-button"]').trigger('click');
    await wrapper.get('[data-testid="section-reference"]').trigger('click');
    expect(wrapper.get('[data-testid="section-reference"]').attributes('aria-expanded')).toBe(
      'true',
    );
    expect(wrapper.get('[data-testid="section-camera"]').attributes('aria-expanded')).toBe('false');
    expect(wrapper.find('[data-testid="reference-select"]').exists()).toBe(true);
    expect(wrapper.find('[role="radiogroup"]').exists()).toBe(false);
    await wrapper.get('[data-testid="section-reference"]').trigger('click');
    expect(wrapper.get('[data-testid="section-reference"]').attributes('aria-expanded')).toBe(
      'false',
    );
    expect(wrapper.find('[data-testid="reference-select"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('nennt in der Kurzfassung die gewählte Kamera und die aktive Auflösung', async () => {
    const wrapper = mountAttached();
    const camera = useCameraStore();
    camera.devices = [{ id: 'cam2', label: 'Webcam 2' }];
    camera.selectedDeviceId = 'cam2';
    camera.actual = { width: 1920, height: 1080 };
    await wrapper.get('[data-testid="settings-button"]').trigger('click');
    expect(wrapper.get('[data-testid="section-camera"]').text()).toContain(
      'Webcam 2 · 1920 × 1080',
    );
    wrapper.unmount();
  });

  it('schließt mit Escape, nicht mit anderen Tasten', async () => {
    const wrapper = mountAttached();
    await wrapper.get('[data-testid="settings-button"]').trigger('click');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await wrapper.vm.$nextTick();
    expect(panel(wrapper).exists()).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wrapper.vm.$nextTick();
    expect(panel(wrapper).exists()).toBe(false);
    wrapper.unmount();
  });

  it('ignoriert Escape bei geschlossenem Menü', async () => {
    const wrapper = mountAttached();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wrapper.vm.$nextTick();
    expect(panel(wrapper).exists()).toBe(false);
    wrapper.unmount();
  });

  it('schließt bei einem Klick außerhalb, nicht bei einem Klick darin', async () => {
    const outside = document.createElement('button');
    document.body.append(outside);
    const wrapper = mountAttached();
    await wrapper.get('[data-testid="settings-button"]').trigger('click');
    wrapper
      .get('[data-testid="settings-panel"]')
      .element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await wrapper.vm.$nextTick();
    expect(panel(wrapper).exists()).toBe(true);
    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await wrapper.vm.$nextTick();
    expect(panel(wrapper).exists()).toBe(false);
    wrapper.unmount();
  });

  it('ignoriert Klicks außerhalb bei geschlossenem Menü', async () => {
    const wrapper = mountAttached();
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await wrapper.vm.$nextTick();
    expect(panel(wrapper).exists()).toBe(false);
    wrapper.unmount();
  });

  it('entfernt seine Ereignisbehandlung beim Abbau', () => {
    const remove = vi.spyOn(document, 'removeEventListener');
    const wrapper = mountAttached();
    wrapper.unmount();
    expect(remove).toHaveBeenCalledWith('pointerdown', expect.any(Function));
    expect(remove).toHaveBeenCalledWith('keydown', expect.any(Function));
    remove.mockRestore();
  });
});
