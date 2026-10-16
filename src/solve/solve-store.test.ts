import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { NEUTRAL_IDS } from '../chart/layouts';
import type { Rgb } from '../chart/types';
import { dummyIds, dummyLab } from '../test-support/dummy-reference';
import { cameraCode } from '../test-support/synthetic-camera';

import { useSolveStore } from './solve-store';

const reference = {
  name: 'Test',
  patches: Object.fromEntries(dummyIds().map((id) => [id, dummyLab(id)])),
};
const measurements: Record<string, Rgb> = Object.fromEntries(
  dummyIds().map((id) => [id, cameraCode(dummyLab(id))]),
);

describe('useSolveStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('berechnet das Modell und den Fehlerbericht', () => {
    const store = useSolveStore();
    store.compute({ measurements, reference, neutralIds: NEUTRAL_IDS });
    expect(store.error).toBeNull();
    expect(store.result?.report.meanAfter).toBeLessThan(store.result?.report.meanBefore ?? 0);
  });

  it('meldet zu wenige Messwerte und verwirft ein altes Ergebnis', () => {
    const store = useSolveStore();
    store.compute({ measurements, reference, neutralIds: NEUTRAL_IDS });
    store.compute({ measurements: {}, reference, neutralIds: NEUTRAL_IDS });
    expect(store.result).toBeNull();
    expect(store.error).toContain('Zu wenige Messwerte');
  });

  it('setzt zurück', () => {
    const store = useSolveStore();
    store.compute({ measurements: {}, reference, neutralIds: NEUTRAL_IDS });
    store.reset();
    expect(store.error).toBeNull();
    expect(store.result).toBeNull();
  });
});
