import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { usePreviewStore } from './preview-store';

describe('usePreviewStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('startet mit der Trennlinie in der Mitte', () => {
    expect(usePreviewStore().split).toBe(50);
  });

  it('begrenzt die Trennlinie auf 0 bis 100 Prozent', () => {
    const store = usePreviewStore();
    store.setSplit(80);
    expect(store.split).toBe(80);
    store.setSplit(250);
    expect(store.split).toBe(100);
    store.setSplit(-1);
    expect(store.split).toBe(0);
  });
});
