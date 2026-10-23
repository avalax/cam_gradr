import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useThemeStore } from './theme-store';

// A device whose color preference can be changed from the test.
function device(dark: boolean) {
  let listener: ((event: { matches: boolean }) => void) | null = null;
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: dark,
      addEventListener: (_type: string, callback: (event: { matches: boolean }) => void) => {
        listener = callback;
      },
    })),
  );
  return {
    change(matches: boolean) {
      listener?.({ matches });
    },
  };
}

describe('useThemeStore', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts with “system” and follows the device', () => {
    const phone = device(true);
    const store = useThemeStore();
    expect(store.preference).toBe('system');
    store.apply();
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    phone.change(false);
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(store.theme).toBe('light');
  });

  it('applies a chosen appearance at once and remembers it', () => {
    device(false);
    const store = useThemeStore();
    store.apply();
    store.choose('dark');
    expect(store.theme).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('avalax.cam_gradr.theme')).toBe('dark');

    // After reloading the page the choice is back.
    setActivePinia(createPinia());
    expect(useThemeStore().preference).toBe('dark');
  });

  it('keeps the choice when the device changes', () => {
    const phone = device(false);
    const store = useThemeStore();
    store.choose('light');
    store.apply();
    phone.change(true);
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('summarizes the choice for the collapsed section', () => {
    device(false);
    const store = useThemeStore();
    expect(store.summary).toBe('System');
    store.choose('dark');
    expect(store.summary).toBe('Dunkel');
  });
});
