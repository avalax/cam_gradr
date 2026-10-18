import { flushPromises, mount } from '@vue/test-utils';
import { IDBFactory } from 'fake-indexeddb';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useChartStore, useColorChartStore } from '../chart/chart-store';
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

  it('zeigt den vorgewählten Referenzsatz und rechnet erst nach der Aufnahme', async () => {
    const wrapper = mount(ColorStep);
    await useReferenceStore().load();
    await flushPromises();
    expect(wrapper.get('[data-testid="reference-active"]').text()).toContain(
      `${BUNDLED_NAME} (48 Felder)`,
    );
    expect(wrapper.findAll('button').map((b) => b.text())).not.toContain('Farbkorrektur berechnen');
    expect(wrapper.text()).toContain('Beide Farbkarten ruhig in die Rahmen');
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

  it('rechnet ohne ausgewählten Referenzsatz nichts', async () => {
    mount(ColorStep);
    prepareMeasurements();
    await flushPromises();
    expect(useSolveStore().result).toBeNull();
    expect(useSolveStore().error).toBeNull();
  });

  it('berechnet die Farbkorrektur selbst, sobald Messwerte da sind, und zeigt den Bericht', async () => {
    const wrapper = mount(ColorStep);
    await useReferenceStore().importFile('a.json', dummyReferenceJson());
    expect(wrapper.find('[data-testid="report"]').exists()).toBe(false);
    prepareMeasurements();
    await flushPromises();
    expect(wrapper.find('[data-testid="report"]').exists()).toBe(true);
    const before = Number(wrapper.get('[data-testid="mean-before"]').text());
    const after = Number(wrapper.get('[data-testid="mean-after"]').text());
    expect(after).toBeLessThan(before);
    expect(useSolveStore().result).not.toBeNull();
  });

  it('kontrolliert die Korrektur mit den gemessenen Graukarten aus Schritt 1', async () => {
    const wrapper = mount(ColorStep);
    await useReferenceStore().importFile('a.json', dummyReferenceJson());
    useChartStore().measurements = { G50: cameraCode([76.07, 0, 0]) };
    prepareMeasurements();
    await flushPromises();
    expect(wrapper.get('[data-testid="gray-G50"]').text()).toContain('Graukarte 50 %');
  });

  it('zeigt ohne gemessene Graukarten keine Kontrolle', async () => {
    const wrapper = mount(ColorStep);
    await useReferenceStore().importFile('a.json', dummyReferenceJson());
    prepareMeasurements();
    await flushPromises();
    expect(wrapper.find('[data-testid="gray-check"]').exists()).toBe(false);
  });

  it('rechnet neu, wenn sich die Messwerte ändern', async () => {
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

  it('rechnet neu, wenn ein anderer Referenzsatz gewählt wird', async () => {
    mount(ColorStep);
    await useReferenceStore().importFile('a.json', dummyReferenceJson('Satz A'));
    prepareMeasurements();
    await flushPromises();
    const first = useSolveStore().result;
    await useReferenceStore().importFile('b.json', dummyReferenceJson('Satz B'));
    await flushPromises();
    expect(useSolveStore().result).not.toBe(first);
  });

  it('rechnet nicht, solange nicht alle Eckpunkte gesetzt sind', async () => {
    mount(ColorStep);
    await useReferenceStore().importFile('a.json', dummyReferenceJson());
    const chart = useColorChartStore();
    chart.addCorner({ x: 100, y: 50 });
    chart.measurements = { '1A': [0.5, 0.5, 0.5] };
    await flushPromises();
    expect(useSolveStore().result).toBeNull();
    expect(useSolveStore().error).toBeNull();
  });

  it('zeigt den Wischer: Standardfarben ohne Messung, danach Kamera und korrigiert', async () => {
    const wrapper = mount(ColorStep);
    await useReferenceStore().importFile('a.json', dummyReferenceJson());
    await flushPromises();
    const camera = wrapper.get('[data-testid="color-wipe-camera"]');
    expect(camera.attributes('data-measured')).toBe('false');
    expect(camera.findAll('[data-patch]')).toHaveLength(48);
    prepareMeasurements();
    await flushPromises();
    expect(wrapper.get('[data-testid="color-wipe-camera"]').attributes('data-measured')).toBe(
      'true',
    );
    expect(wrapper.get('[data-testid="color-wipe-corrected"]').attributes('data-measured')).toBe(
      'true',
    );
  });

  it('meldet Fehler der Berechnung', async () => {
    const wrapper = mount(ColorStep);
    await useReferenceStore().importFile('a.json', dummyReferenceJson());
    const chart = prepareMeasurements();
    chart.measurements = { '1A': [0.5, 0.5, 0.5] };
    await flushPromises();
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
