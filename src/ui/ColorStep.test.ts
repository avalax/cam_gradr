import { flushPromises, mount } from '@vue/test-utils';
import { IDBFactory } from 'fake-indexeddb';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useColorChartStore } from '../chart/chart-store';
import type { Rgb } from '../chart/types';
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

// Setzt Eckpunkte und Messwerte so, als wäre ein Standbild der Farbkarten ausgewertet worden.
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

function computeButton(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll('button').find((b) => b.text().includes('Farbkorrektur berechnen'));
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

  it('zeigt den vorgewählten Referenzsatz und sperrt die Berechnung bis zur Aufnahme', async () => {
    const wrapper = mount(ColorStep);
    await useReferenceStore().load();
    await flushPromises();
    expect(wrapper.get('[data-testid="reference-active"]').text()).toContain(
      `${BUNDLED_NAME} (48 Felder)`,
    );
    expect(computeButton(wrapper)?.attributes('disabled')).toBeDefined();
    expect(wrapper.text()).toContain('Beide Farbkarten ruhig vor die Kamera');
    expect(wrapper.find('[data-testid="report"]').exists()).toBe(false);
  });

  it('zeigt vor dem Laden der Referenzen keine Angabe dazu', () => {
    const wrapper = mount(ColorStep);
    expect(wrapper.find('[data-testid="reference-active"]').exists()).toBe(false);
  });

  it('folgt dem gewählten Satz', async () => {
    const wrapper = mount(ColorStep);
    await useReferenceStore().importFile('a.json', dummyReferenceJson('Mein Satz'));
    await flushPromises();
    expect(wrapper.get('[data-testid="reference-active"]').text()).toContain(
      'Mein Satz (48 Felder)',
    );
  });

  it('rechnet ohne ausgewählten Referenzsatz nichts', () => {
    const wrapper = mount(ColorStep);
    (wrapper.vm as unknown as { compute: () => void }).compute();
    expect(useSolveStore().result).toBeNull();
    expect(useSolveStore().error).toBeNull();
  });

  it('berechnet die Farbkorrektur aus Messwerten und Referenz und zeigt den Bericht', async () => {
    const wrapper = mount(ColorStep);
    await useReferenceStore().importFile('a.json', dummyReferenceJson());
    prepareMeasurements();
    await flushPromises();
    const compute = computeButton(wrapper);
    expect(compute?.attributes('disabled')).toBeUndefined();
    await compute?.trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="report"]').exists()).toBe(true);
    const before = Number(wrapper.get('[data-testid="mean-before"]').text());
    const after = Number(wrapper.get('[data-testid="mean-after"]').text());
    expect(after).toBeLessThan(before);
    expect(useSolveStore().result).not.toBeNull();
  });

  it('meldet Fehler der Berechnung', async () => {
    const wrapper = mount(ColorStep);
    await useReferenceStore().importFile('a.json', dummyReferenceJson());
    const chart = prepareMeasurements();
    chart.measurements = { '1A': [0.5, 0.5, 0.5] };
    await flushPromises();
    await computeButton(wrapper)?.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Zu wenige Messwerte');
    expect(wrapper.find('[data-testid="report"]').exists()).toBe(false);
  });

  it('zeigt keine eigenen Kameraoptionen (die liegen im Zahnrad-Menü)', () => {
    const wrapper = mount(ColorStep);
    expect(wrapper.text()).not.toContain('Aktive Auflösung');
    expect(wrapper.text()).toContain('Die Kamera ist aus');
  });
});
