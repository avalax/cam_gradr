import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { dummyReference } from '../test-support/dummy-reference';
import { syntheticMeasurements } from '../test-support/synthetic-camera';

import { useSolveStore } from './solve-store';

const reference = dummyReference();
const measurements = syntheticMeasurements();

describe('useSolveStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('computes the model and the error report', () => {
    const store = useSolveStore();
    store.compute({ measurements, reference });
    expect(store.error).toBeNull();
    expect(store.result?.report.meanAfter).toBeLessThan(store.result?.report.meanBefore ?? 0);
  });

  it('reports too few measurements and discards an old result', () => {
    const store = useSolveStore();
    store.compute({ measurements, reference });
    store.compute({ measurements: {}, reference });
    expect(store.result).toBeNull();
    expect(store.model).toBeNull();
    expect(store.error).toContain('Zu wenige Messwerte');
  });

  it('provides the model, even without a report after loading', () => {
    const store = useSolveStore();
    store.compute({ measurements, reference });
    const model = store.model;
    expect(model).not.toBeNull();
    store.compute({ measurements: {}, reference });
    expect(store.model).toBeNull();
    if (model !== null) {
      store.loadModel(model);
    }
    expect(store.model).toBe(model);
    expect(store.result).toBeNull();
    expect(store.error).toBeNull();
  });
});
