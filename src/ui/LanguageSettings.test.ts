import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { setLocale } from '../lang';
import { useLanguageStore } from '../lang/language-store';

import LanguageSettings from './LanguageSettings.vue';

describe('LanguageSettings', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('offers “automatic” and each language under its own name', () => {
    const wrapper = mount(LanguageSettings);
    const radios = wrapper.findAll('[role="radio"]');
    expect(radios.map((radio) => radio.text())).toEqual([
      'Automatisch (Browser)',
      'English',
      'Deutsch',
    ]);
    expect(radios.map((radio) => radio.attributes('aria-checked'))).toEqual([
      'true',
      'false',
      'false',
    ]);
    expect(wrapper.get('[role="radiogroup"]').attributes('aria-label')).toBe('Sprache der App');
  });

  it('marks the language of each button for screen readers', () => {
    const wrapper = mount(LanguageSettings);
    expect(wrapper.get('[data-language="auto"]').attributes('lang')).toBeUndefined();
    expect(wrapper.get('[data-language="en"]').attributes('lang')).toBe('en');
    expect(wrapper.get('[data-language="de"]').attributes('lang')).toBe('de');
  });

  it('switches the language immediately and relabels itself afterwards', async () => {
    const wrapper = mount(LanguageSettings);
    await wrapper.get('[data-language="en"]').trigger('click');
    expect(useLanguageStore().preference).toBe('en');
    expect(wrapper.get('[data-language="auto"]').text()).toBe('Automatic (browser)');
    expect(wrapper.get('[data-language="en"]').attributes('aria-checked')).toBe('true');
    expect(wrapper.get('[role="radiogroup"]').attributes('aria-label')).toBe('Language of the app');
    await wrapper.get('[data-language="de"]').trigger('click');
    expect(wrapper.get('[data-language="auto"]').text()).toBe('Automatisch (Browser)');
  });

  it('shows the texts in the selected language', () => {
    setLocale('en');
    const wrapper = mount(LanguageSettings);
    expect(wrapper.text()).toContain('Automatic follows the language of your browser.');
  });
});
