import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

  it('öffnet und schließt das Menü mit dem Zahnrad und zeigt Referenzen und Projekt', async () => {
    const wrapper = mountAttached();
    await wrapper.get('[data-testid="settings-button"]').trigger('click');
    expect(panel(wrapper).exists()).toBe(true);
    expect(wrapper.get('[data-testid="settings-button"]').attributes('aria-expanded')).toBe('true');
    expect(wrapper.text()).toContain('Referenzwerte');
    expect(wrapper.find('[data-testid="project-save"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="project-file"]').exists()).toBe(true);
    await wrapper.get('[data-testid="settings-button"]').trigger('click');
    expect(panel(wrapper).exists()).toBe(false);
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

  it('schließt nach dem Speichern des Projekts', async () => {
    const wrapper = mountAttached();
    await wrapper.get('[data-testid="settings-button"]').trigger('click');
    await wrapper.get('[data-testid="project-save"]').trigger('click');
    expect(download).toHaveBeenCalledTimes(1);
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
