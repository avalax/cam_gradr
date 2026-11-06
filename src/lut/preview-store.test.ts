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

  it('starts without a look LUT, at full strength, with the camera left', () => {
    const store = usePreviewStore();
    expect(store.look).toBeNull();
    expect(store.strength).toBe(100);
    expect(store.left).toBe('camera');
  });

  it('chooses a look, rounds and clamps its strength and sets the left side', () => {
    const store = usePreviewStore();
    store.setLook('Warm');
    store.setStrength(42.6);
    store.setLeft('corrected');
    expect(store.look).toBe('Warm');
    expect(store.strength).toBe(43);
    expect(store.left).toBe('corrected');
    store.setStrength(120);
    expect(store.strength).toBe(100);
    store.setStrength(-5);
    expect(store.strength).toBe(0);
    store.setLook(null);
    expect(store.look).toBeNull();
  });
});
