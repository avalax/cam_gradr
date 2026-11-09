import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { i18n } from '../lang';
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
    expect(store.referenceName).toBe(reference.name);
  });

  it('reports too few measurements and discards an old result', () => {
    const store = useSolveStore();
    store.compute({ measurements, reference });
    store.compute({ measurements: {}, reference });
    expect(store.result).toBeNull();
    expect(store.model).toBeNull();
    expect(store.referenceName).toBeNull();
    expect(store.error).toBe('Zu wenige Messwerte: mindestens 8 Felder, davon 4 neutrale.');
    i18n.global.locale.value = 'en';
    expect(store.error).toBe('Too few measurements: at least 8 patches, 4 of them neutral.');
  });

  it('provides the model, even without a report after loading', () => {
    const store = useSolveStore();
    store.compute({ measurements, reference });
    const model = store.model;
    expect(model).not.toBeNull();
    store.compute({ measurements: {}, reference });
    expect(store.model).toBeNull();
    if (model !== null) {
      store.loadModel(model, 'Fehlender Satz');
    }
    expect(store.model).toBe(model);
    expect(store.referenceName).toBe('Fehlender Satz');
    expect(store.result).toBeNull();
    expect(store.error).toBeNull();
    // Without a model there is no set it was fitted with.
    store.loadModel(null, 'Fehlender Satz');
    expect(store.referenceName).toBeNull();
  });
});
