import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { usePreviewStore } from './preview-store';

describe('usePreviewStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('starts with the split line in the middle', () => {
    expect(usePreviewStore().split).toBe(50);
  });

  it('clamps the split line to 0 to 100 percent', () => {
    const store = usePreviewStore();
    store.setSplit(80);
    expect(store.split).toBe(80);
    store.setSplit(250);
    expect(store.split).toBe(100);
    store.setSplit(-1);
    expect(store.split).toBe(0);
  });
});
