import { flushPromises, mount } from '@vue/test-utils';
import { IDBFactory } from 'fake-indexeddb';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCameraStore } from '../camera/camera-store';
import { useChartStore, useColorChartStore } from '../chart/chart-store';
import type { Rgb } from '../chart/types';
import { setLocale } from '../lang';
import { BUNDLED_NAME } from '../reference/bundled';
import { setReferenceStorage, useReferenceStore } from '../reference/reference-store';
import { createIndexedDbStorage } from '../reference/storage';
import { useSolveStore } from '../solve/solve-store';
import { installFakeCamera, installMediaStubs } from '../test-support/media';
import { dummyIds, dummyLab, dummyReferenceJson } from '../test-support/dummy-reference';
import { cameraCode } from '../test-support/synthetic-camera';

import ColorStep from './ColorStep.vue';

const CORNERS = [
  [100, 50],
  [500, 50],
  [500, 650],
  [100, 650],
  [700, 50],
  [1100, 50],
  [1100, 650],
  [700, 650],
] as const;

// Sets corners and measurements as if a still image of the color cards had been evaluated.
function prepareMeasurements() {
  const chart = useColorChartStore();
  for (const [x, y] of CORNERS) {
    chart.addCorner({ x, y });
  }
  chart.measurements = Object.fromEntries(
    dummyIds().map((id): [string, Rgb] => [id, cameraCode(dummyLab(id))]),
  );
  return chart;
}

describe('ColorStep', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    installMediaStubs();
    installFakeCamera();
    setReferenceStorage(createIndexedDbStorage(new IDBFactory(), 'test'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the preselected reference set and only computes after the capture', async () => {
    const wrapper = mount(ColorStep);
    await useReferenceStore().load();
    await flushPromises();
    expect(wrapper.get('[data-testid="reference-active"]').text()).toContain(
      `${BUNDLED_NAME} (48 Felder)`,
    );
    expect(wrapper.findAll('button').map((b) => b.text())).not.toContain('Farbkorrektur berechnen');
    expect(wrapper.text()).toContain('Beide Farbkarten ruhig dorthin halten, wo das Motiv steht');
    expect(wrapper.find('[data-testid="report"]').exists()).toBe(false);
  });

  it('shows no reference info before the references are loaded', () => {
    const wrapper = mount(ColorStep);
    expect(wrapper.find('[data-testid="reference-active"]').exists()).toBe(false);
  });

  it('follows the selected set', async () => {
    const wrapper = mount(ColorStep);
    await useReferenceStore().importFile('a.json', dummyReferenceJson('Mein Satz'));
    await flushPromises();
    expect(wrapper.get('[data-testid="reference-active"]').text()).toContain(
      'Mein Satz (48 Felder)',
    );
  });

  it('computes nothing without a selected reference set', async () => {
    mount(ColorStep);
    prepareMeasurements();
    await flushPromises();
    expect(useSolveStore().result).toBeNull();
    expect(useSolveStore().error).toBeNull();
  });

  it('computes the color correction by itself once measurements exist, and shows the report', async () => {
    const wrapper = mount(ColorStep);
    await useReferenceStore().importFile('a.json', dummyReferenceJson());
    expect(wrapper.find('[data-testid="report"]').exists()).toBe(false);
    prepareMeasurements();
    await flushPromises();
    expect(wrapper.find('[data-testid="report"]').exists()).toBe(true);
    const before = Number(wrapper.get('[data-testid="mean-before"]').text().replace(',', '.'));
    const after = Number(wrapper.get('[data-testid="mean-after"]').text().replace(',', '.'));
    expect(after).toBeLessThan(before);
    expect(useSolveStore().result).not.toBeNull();
  });

  it('checks the correction against the measured gray cards from step 1', async () => {
    const wrapper = mount(ColorStep);
    await useReferenceStore().importFile('a.json', dummyReferenceJson());
    useChartStore().measurements = { G50: cameraCode([76.07, 0, 0]) };
    prepareMeasurements();
    await flushPromises();
    expect(wrapper.get('[data-testid="gray-G50"]').text()).toContain('Graukarte 50 %');
  });

  it('shows no check without measured gray cards', async () => {
    const wrapper = mount(ColorStep);
    await useReferenceStore().importFile('a.json', dummyReferenceJson());
    prepareMeasurements();
    await flushPromises();
    expect(wrapper.find('[data-testid="gray-check"]').exists()).toBe(false);
  });

  it('recomputes when the measurements change', async () => {
    const wrapper = mount(ColorStep);
    await useReferenceStore().importFile('a.json', dummyReferenceJson());
    const chart = prepareMeasurements();
    await flushPromises();
    const first = useSolveStore().result;
    chart.measurements = Object.fromEntries(
      dummyIds().map((id): [string, Rgb] => [
        id,
        cameraCode(dummyLab(id)).map((v) => v * 0.9) as unknown as Rgb,
      ]),
    );
    await flushPromises();
    expect(useSolveStore().result).not.toBe(first);
    expect(wrapper.find('[data-testid="report"]').exists()).toBe(true);
  });

  it('recomputes when a different reference set is selected', async () => {
    mount(ColorStep);
    await useReferenceStore().importFile('a.json', dummyReferenceJson('Satz A'));
    prepareMeasurements();
    await flushPromises();
    const first = useSolveStore().result;
    await useReferenceStore().importFile('b.json', dummyReferenceJson('Satz B'));
    await flushPromises();
    expect(useSolveStore().result).not.toBe(first);
  });

  it('does not compute until all corner points are set', async () => {
    mount(ColorStep);
    await useReferenceStore().importFile('a.json', dummyReferenceJson());
    const chart = useColorChartStore();
    chart.addCorner({ x: 100, y: 50 });
    chart.measurements = { '1A': [0.5, 0.5, 0.5] };
    await flushPromises();
    expect(useSolveStore().result).toBeNull();
    expect(useSolveStore().error).toBeNull();
  });

  it('shows the wipe: default colors without a measurement, then camera and corrected', async () => {
    const wrapper = mount(ColorStep);
    await useReferenceStore().importFile('a.json', dummyReferenceJson());
    await flushPromises();
    const camera = wrapper.get('[data-testid="color-wipe-camera"]');
    expect(camera.attributes('data-measured')).toBe('false');
    expect(camera.findAll('[data-patch]')).toHaveLength(48);
    // The measurement of the (tiny) still image is replaced by prepared measurements afterwards.
    const chart = prepareMeasurements();
    const measurements = chart.measurements;
    useCameraStore().still = { width: 1, height: 1, data: new Float32Array(3) };
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
    camera.still = { width: 1, height: 1, data: new Float32Array(3) };
    await flushPromises();
    expect(wrapper.find('[data-testid="wipe"]').exists()).toBe(true);
  });

  it('reports calculation errors', async () => {
    const wrapper = mount(ColorStep);
    await useReferenceStore().importFile('a.json', dummyReferenceJson());
    const chart = prepareMeasurements();
    chart.measurements = { '1A': [0.5, 0.5, 0.5] };
    await flushPromises();
    await flushPromises();
    expect(wrapper.text()).toContain('Zu wenige Messwerte');
    expect(wrapper.find('[data-testid="report"]').exists()).toBe(false);
  });

  it('shows no camera options of its own (they live in the gear menu)', () => {
    const wrapper = mount(ColorStep);
    expect(wrapper.text()).not.toContain('Aktive Auflösung');
    expect(wrapper.text()).toContain('Die Kamera ist aus');
  });
});

describe('ColorStep (English)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    installMediaStubs();
    installFakeCamera();
    setReferenceStorage(createIndexedDbStorage(new IDBFactory(), 'test'));
  });

  it('explains the tab and names the reference set in English', async () => {
    setLocale('en');
    const wrapper = mount(ColorStep);
    await useReferenceStore().load();
    await flushPromises();
    expect(wrapper.text()).toContain('This tab calculates the color correction.');
    expect(wrapper.get('[data-testid="reference-active"]').text()).toContain(
      `Reference values: ${BUNDLED_NAME} (48 patches).`,
    );
    expect(wrapper.text()).toContain('Hold both color cards steady where the subject will be');
  });

  it('shows the report in English', async () => {
    setLocale('en');
    const wrapper = mount(ColorStep);
    await useReferenceStore().importFile('a.json', dummyReferenceJson());
    prepareMeasurements();
    await flushPromises();
    expect(wrapper.get('[data-testid="report"]').text()).toContain('Color correction result');
  });
});
