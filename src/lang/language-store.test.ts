import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { useLanguageStore } from './language-store';

import { i18n } from './index';

describe('useLanguageStore', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('starts with “auto” when nothing is saved', () => {
    expect(useLanguageStore().preference).toBe('auto');
  });

  it('applies a chosen language at once and remembers it', () => {
    const store = useLanguageStore();
    store.choose('en');
    expect(store.preference).toBe('en');
    expect(store.locale).toBe('en');
    expect(i18n.global.locale.value).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(localStorage.getItem('avalax.cam_gradr.language')).toBe('en');

    // After reloading the page the choice is back.
    setActivePinia(createPinia());
    expect(useLanguageStore().preference).toBe('en');
  });

  it('follows the browser language for “auto”', () => {
    const store = useLanguageStore();
    store.choose('de');
    store.choose('auto');
    expect(store.preference).toBe('auto');
    expect(['en', 'de']).toContain(store.locale);
  });

  it('summarizes the choice for the collapsed section', () => {
    const store = useLanguageStore();
    store.choose('en');
    expect(store.summary).toBe('English');
    store.choose('de');
    expect(store.summary).toBe('Deutsch');
    store.choose('auto');
    expect(store.summary).toContain('(automati');
  });

  it('takes over the saved choice at start', () => {
    localStorage.setItem('avalax.cam_gradr.language', 'en');
    setActivePinia(createPinia());
    const store = useLanguageStore();
    store.apply();
    expect(store.locale).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });
});
