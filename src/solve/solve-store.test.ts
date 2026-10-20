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

  it('computes the model and the error report', () => {
    const store = useSolveStore();
    store.compute({ measurements, reference, neutralIds: NEUTRAL_IDS });
    expect(store.error).toBeNull();
    expect(store.result?.report.meanAfter).toBeLessThan(store.result?.report.meanBefore ?? 0);
  });

  it('reports too few measurements and discards an old result', () => {
    const store = useSolveStore();
    store.compute({ measurements, reference, neutralIds: NEUTRAL_IDS });
    store.compute({ measurements: {}, reference, neutralIds: NEUTRAL_IDS });
    expect(store.result).toBeNull();
    expect(store.model).toBeNull();
    expect(store.error).toContain('Zu wenige Messwerte');
  });

  it('provides the model, even without a report after loading', () => {
    const store = useSolveStore();
    store.compute({ measurements, reference, neutralIds: NEUTRAL_IDS });
    const model = store.model;
    expect(model).not.toBeNull();
    store.reset();
    expect(store.model).toBeNull();
    if (model !== null) {
      store.loadModel(model);
    }
    expect(store.model).toBe(model);
    expect(store.result).toBeNull();
    expect(store.error).toBeNull();
  });

  it('resets', () => {
    const store = useSolveStore();
    store.compute({ measurements: {}, reference, neutralIds: NEUTRAL_IDS });
    store.reset();
    expect(store.error).toBeNull();
    expect(store.result).toBeNull();
  });
});

describe('the tone setting', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('recomputes the model with the new setting', () => {
    const store = useSolveStore();
    store.compute({ measurements, reference, neutralIds: NEUTRAL_IDS });
    expect(store.tone).toBe(true);
    expect(store.canChangeTone).toBe(true);
    const withTone = store.model;
    store.setTone(false);
    expect(store.tone).toBe(false);
    expect(store.model).not.toBe(withTone);
    expect(store.model?.curves[0].xs).toHaveLength(3);
    store.compute({ measurements, reference, neutralIds: NEUTRAL_IDS });
    expect(store.model?.curves[0].xs).toHaveLength(3);
  });

  it('only remembers the setting without a calculation', () => {
    const store = useSolveStore();
    expect(store.canChangeTone).toBe(false);
    store.setTone(false);
    expect(store.tone).toBe(false);
    expect(store.model).toBeNull();
  });

  it('cannot change the setting for a model that was loaded', () => {
    const store = useSolveStore();
    store.compute({ measurements, reference, neutralIds: NEUTRAL_IDS });
    const model = store.model;
    if (model !== null) {
      store.loadModel(model);
    }
    expect(store.canChangeTone).toBe(false);
    store.reset();
    expect(store.canChangeTone).toBe(false);
  });
});
