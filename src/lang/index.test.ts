// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { i18n, resolveLocale, setLocale } from './index';

describe('resolveLocale', () => {
  it('follows the browser language for “auto”', () => {
    expect(resolveLocale('auto', ['de-CH'])).toBe('de');
    expect(resolveLocale('auto', ['fr'])).toBe('en');
  });

  it('takes a chosen language regardless of the browser', () => {
    expect(resolveLocale('en', ['de'])).toBe('en');
    expect(resolveLocale('de', ['en'])).toBe('de');
  });

  it('reads the browser languages when none are given', () => {
    vi.stubGlobal('navigator', { languages: ['de-AT', 'en'] });
    try {
      expect(resolveLocale('auto')).toBe('de');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('setLocale', () => {
  it('switches the app language and the lang attribute of the page', () => {
    setLocale('en');
    expect(i18n.global.locale.value).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    setLocale('de');
    expect(i18n.global.locale.value).toBe('de');
    expect(document.documentElement.lang).toBe('de');
  });
});
