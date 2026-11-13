// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import type { WatchStopHandle } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCameraStore } from '../camera/camera-store';
import { useChartStore, useColorChartStore } from '../chart/chart-store';
import { BUNDLED_NAME } from '../reference/bundled';
import { useReferenceStore } from '../reference/reference-store';
import { recomputeOnChange } from '../solve/recompute';
import { useSolveStore } from '../solve/solve-store';
import { bothCards } from '../test-support/cards';
import { chosenFile } from '../test-support/chosen-file';
import { dummyReferenceJson } from '../test-support/dummy-reference';
import { grayFrame } from '../test-support/frames';
import { IDENTITY_MODEL } from '../test-support/identity-model';
import { installFakeCamera, installMediaStubs } from '../test-support/media';
import { cameraCode, syntheticMeasurements } from '../test-support/synthetic-camera';
import { emptyReferenceStorage } from '../test-support/empty-storage';

import ColorStep from './ColorStep.vue';

const { fitOnce } = await vi.hoisted(() => import('../test-support/fit-once'));
vi.mock(import('../solve/fit'), async (original) => fitOnce(await original()));

// Sets corners and measurements as if a still image of the color cards had been evaluated.
function prepareMeasurements() {
  const chart = useColorChartStore();
  chart.setCards(bothCards());
  chart.measurements = syntheticMeasurements();
  return chart;
}

describe('ColorStep', () => {
  // The app recomputes the correction on every change (src/solve/recompute.ts, tested there); here
  // it runs as in the app, so that the tab shows what comes out.
  let stopRecompute: WatchStopHandle;

  beforeEach(() => {
    setActivePinia(createPinia());
    installMediaStubs();
    installFakeCamera();
    emptyReferenceStorage();
    stopRecompute = recomputeOnChange();
  });

  afterEach(() => {
    stopRecompute();
    vi.restoreAllMocks();
  });

  it('shows the preselected reference set and only computes after the capture', async () => {
    const wrapper = mount(ColorStep);
    await useReferenceStore().load();
    await flushPromises();
    expect(wrapper.get('[data-testid="reference-active"]').text()).toContain(
      `„${BUNDLED_NAME}“ mit 48 Feldern`,
    );
    expect(wrapper.text()).toContain('Hier entsteht die Farbkorrektur');
    expect(wrapper.find('[data-testid="report"]').exists()).toBe(false);
  });

  it('names the missing set of a loaded correction without a report instead of the active one', async () => {
    const wrapper = mount(ColorStep);
    await useReferenceStore().load();
    useSolveStore().loadModel(IDENTITY_MODEL, 'Fehlender Satz');
    await flushPromises();
    const sentence = wrapper.get('[data-testid="reference-active"]').text();
    expect(sentence).toContain('Referenzsatz „Fehlender Satz“ (fehlt)');
    expect(sentence).not.toContain(BUNDLED_NAME);
    expect(wrapper.get('[data-testid="color-wipe-summary"]').text()).toBe(
      'Ohne Bericht (Referenz fehlt)',
    );
    // Without a name, or with a set the browser has, the active set is named as usual.
    for (const name of [null, BUNDLED_NAME]) {
      useSolveStore().loadModel(IDENTITY_MODEL, name);
      await flushPromises();
      expect(wrapper.get('[data-testid="reference-active"]').text()).toContain('mit 48 Feldern');
    }
  });

  it('shows no reference info before the references are loaded', () => {
    const wrapper = mount(ColorStep);
    expect(wrapper.find('[data-testid="reference-active"]').exists()).toBe(false);
  });

  it('follows the selected set', async () => {
    const wrapper = mount(ColorStep);
    await useReferenceStore().importChosen(chosenFile('a.json', dummyReferenceJson('Mein Satz')));
    await flushPromises();
    expect(wrapper.get('[data-testid="reference-active"]').text()).toContain(
      '„Mein Satz“ mit 48 Feldern',
    );
  });

  it('checks the correction against the measured gray cards from step 1', async () => {
    const wrapper = mount(ColorStep);
    await useReferenceStore().importChosen(chosenFile('a.json', dummyReferenceJson()));
    useChartStore().measurements = { G50: cameraCode([76.07, 0, 0]) };
    prepareMeasurements();
    await flushPromises();
    expect(wrapper.get('[data-testid="gray-G50"]').text()).toContain('Graukarte 50 %');
  });

  it('shows the wipe: default colors without a measurement, then camera and corrected', async () => {
    const wrapper = mount(ColorStep);
    await useReferenceStore().importChosen(chosenFile('a.json', dummyReferenceJson()));
    await flushPromises();
    const camera = wrapper.get('[data-testid="color-wipe-camera"]');
    expect(camera.attributes('data-measured')).toBe('false');
    // The measurement of the (tiny) still image is replaced by prepared measurements afterwards.
    const chart = prepareMeasurements();
    const measurements = chart.measurements;
    useCameraStore().still = grayFrame(1, 1);
    await flushPromises();
    chart.measurements = measurements;
    await flushPromises();
    expect(wrapper.get('[data-testid="color-wipe-camera"]').attributes('data-measured')).toBe(
      'true',
    );
    expect(wrapper.get('[data-testid="color-wipe-corrected"]').attributes('data-measured')).toBe(
      'true',
    );
  });

  it('hides the divider without a still image and shows it with one', async () => {
    const wrapper = mount(ColorStep);
    await flushPromises();
    expect(wrapper.find('[data-testid="wipe"]').exists()).toBe(false);
    const camera = useCameraStore();
    camera.status = 'live';
    await flushPromises();
    expect(wrapper.find('[data-testid="wipe"]').exists()).toBe(false);
    camera.still = grayFrame(1, 1);
    await flushPromises();
    expect(wrapper.find('[data-testid="wipe"]').exists()).toBe(true);
  });

  it('reports calculation errors', async () => {
    const wrapper = mount(ColorStep);
    await useReferenceStore().importChosen(chosenFile('a.json', dummyReferenceJson()));
    const chart = prepareMeasurements();
    chart.measurements = { '1A': [0.5, 0.5, 0.5] };
    await flushPromises();
    await flushPromises();
    // In the text column, as the error of the preview.
    expect(wrapper.get('aside [role="alert"]').text()).toContain('Zu wenige Messwerte');
    expect(wrapper.find('[data-testid="report"]').exists()).toBe(false);
  });
});
