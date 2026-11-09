import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import type { WatchStopHandle } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useColorChartStore } from '../chart/chart-store';
import { useReferenceStore } from '../reference/reference-store';
import { dummyReferenceJson } from '../test-support/dummy-reference';
import { IDENTITY_MODEL } from '../test-support/identity-model';
import { syntheticMeasurements } from '../test-support/synthetic-camera';
import { emptyReferenceStorage } from '../test-support/empty-storage';

import { recomputeOnChange } from './recompute';
import { useSolveStore } from './solve-store';

const { fitOnce } = await vi.hoisted(() => import('../test-support/fit-once'));
vi.mock(import('./fit'), async (original) => fitOnce(await original()));

// Measurements of the color cards as a project without still images brings them: no corner points.
function measurementsWithoutCorners(): void {
  useColorChartStore().restore({
    points: {},
    measurements: syntheticMeasurements(),
    rotated: false,
  });
}

describe('recomputeOnChange', () => {
  let stop: WatchStopHandle;

  beforeEach(() => {
    setActivePinia(createPinia());
    emptyReferenceStorage();
    stop = recomputeOnChange();
  });

  afterEach(() => {
    stop();
  });

  it('computes nothing without a selected reference set or without measurements', async () => {
    measurementsWithoutCorners();
    await nextTick();
    expect(useSolveStore().model).toBeNull();
    useColorChartStore().restore({ points: {}, measurements: {}, rotated: false });
    await useReferenceStore().importFile('a.json', dummyReferenceJson('Satz A'));
    await nextTick();
    expect(useSolveStore().model).toBeNull();
    expect(useSolveStore().error).toBeNull();
  });

  it('computes from measurements without corner points, as a project without still images has', async () => {
    await useReferenceStore().importFile('a.json', dummyReferenceJson('Satz A'));
    measurementsWithoutCorners();
    await nextTick();
    expect(useSolveStore().result).not.toBeNull();
    expect(useSolveStore().referenceName).toBe('Satz A');
  });

  it('gives a loaded correction its report once its set is imported, on any tab', async () => {
    measurementsWithoutCorners();
    useSolveStore().loadModel(IDENTITY_MODEL, 'Fehlender Satz');
    await nextTick();
    expect(useSolveStore().result).toBeNull();
    await useReferenceStore().importFile('fehlt.json', dummyReferenceJson('Fehlender Satz'));
    await nextTick();
    expect(useSolveStore().result).not.toBeNull();
    expect(useSolveStore().referenceName).toBe('Fehlender Satz');
  });

  it('recomputes when the measurements change or another set is chosen', async () => {
    const references = useReferenceStore();
    await references.importFile('a.json', dummyReferenceJson('Satz A'));
    await references.importFile('b.json', dummyReferenceJson('Satz B'));
    const compute = vi.spyOn(useSolveStore(), 'compute');
    measurementsWithoutCorners();
    await nextTick();
    references.select('Satz A');
    await nextTick();
    measurementsWithoutCorners();
    await nextTick();
    expect(compute.mock.calls.map(([input]) => input.reference.name)).toEqual([
      'Satz B',
      'Satz A',
      'Satz A',
    ]);
    expect(useSolveStore().referenceName).toBe('Satz A');
  });
});
