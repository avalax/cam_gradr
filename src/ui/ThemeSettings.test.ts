import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useThemeStore } from '../theme/theme-store';

import ThemeSettings from './ThemeSettings.vue';

describe('ThemeSettings', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false, addEventListener: vi.fn() })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('offers system, light and dark', () => {
    const wrapper = mount(ThemeSettings);
    const radios = wrapper.findAll('[role="radio"]');
    expect(radios.map((radio) => radio.text())).toEqual(['System', 'Hell', 'Dunkel']);
    expect(radios.map((radio) => radio.attributes('aria-checked'))).toEqual([
      'true',
      'false',
      'false',
    ]);
    expect(wrapper.get('[role="radiogroup"]').attributes('aria-label')).toBe('Darstellung der App');
  });

  it('switches the appearance at once', async () => {
    const wrapper = mount(ThemeSettings);
    await wrapper.get('[data-theme-option="dark"]').trigger('click');
    expect(useThemeStore().preference).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(wrapper.get('[data-theme-option="dark"]').attributes('aria-checked')).toBe('true');
    expect(wrapper.get('[data-theme-option="system"]').attributes('aria-checked')).toBe('false');
  });
});
