import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { usePreviewStore } from './preview-store';

describe('usePreviewStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('startet mit voller Korrektur und Trennlinie in der Mitte', () => {
    const store = usePreviewStore();
    expect(store.strength).toBe(100);
    expect(store.split).toBe(50);
  });

  it('begrenzt Stärke und Trennlinie auf 0 bis 100 Prozent', () => {
    const store = usePreviewStore();
    store.setStrength(30);
    store.setSplit(80);
    expect([store.strength, store.split]).toEqual([30, 80]);
    store.setStrength(-5);
    store.setSplit(250);
    expect([store.strength, store.split]).toEqual([0, 100]);
    store.setStrength(140);
    store.setSplit(-1);
    expect([store.strength, store.split]).toEqual([100, 0]);
  });
});
