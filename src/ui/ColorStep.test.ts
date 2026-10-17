import { flushPromises, mount } from '@vue/test-utils';
import { IDBFactory } from 'fake-indexeddb';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useColorChartStore } from '../chart/chart-store';
import type { Rgb } from '../chart/types';
import { BUNDLED_NAME, BUNDLED_SOURCE_URL } from '../reference/bundled';
import { setReferenceStorage, useReferenceStore } from '../reference/reference-store';
import { createIndexedDbStorage } from '../reference/storage';
import { useSolveStore } from '../solve/solve-store';
import { installFakeCamera, installMediaStubs } from '../test-support/media';
import {
  dummyIds,
  dummyLab,
  dummyReferenceCsv,
  dummyReferenceJson,
} from '../test-support/dummy-reference';
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

function fakeFile(name: string, text: string) {
  return { name, text: () => Promise.resolve(text) };
}

async function chooseFile(wrapper: ReturnType<typeof mount>, name: string, text: string) {
  const input = wrapper.get('[data-testid="reference-file"]');
  Object.defineProperty(input.element, 'files', {
    value: [fakeFile(name, text)],
    configurable: true,
  });
  await input.trigger('change');
  await flushPromises();
}

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

function button(wrapper: ReturnType<typeof mount>, text: string) {
  return wrapper.findAll('button').find((b) => b.text().includes(text));
}

const download = vi.hoisted(() => vi.fn());
vi.mock('../lut/download', () => ({ downloadFile: download }));

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

  it('verlangt zuerst Referenzwerte und sperrt die Berechnung', async () => {
    const wrapper = mount(ColorStep);
    await flushPromises();
    expect(wrapper.get('[data-testid="reference-hint"]').text()).toContain(
      'Noch keine Referenzwerte',
    );
    expect(button(wrapper, 'Farbkorrektur berechnen')?.attributes('disabled')).toBeDefined();
    expect(wrapper.text()).toContain('Beide Farbkarten ruhig vor die Kamera');
    expect(wrapper.find('[data-testid="report"]').exists()).toBe(false);
  });

  it('importiert eine JSON-Datei und zeigt den aktiven Satz', async () => {
    const wrapper = mount(ColorStep);
    await chooseFile(wrapper, 'a.json', dummyReferenceJson('Mein Satz'));
    expect(wrapper.get('[data-testid="reference-active"]').text()).toContain(
      'Mein Satz (48 Felder)',
    );
    expect(wrapper.find('[data-testid="reference-hint"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="reference-select"]').element).toBeDefined();
  });

  it('zeigt, dass der Satz lokal gespeichert wurde', async () => {
    const wrapper = mount(ColorStep);
    expect(wrapper.find('[data-testid="reference-saved"]').exists()).toBe(false);
    await chooseFile(wrapper, 'a.json', dummyReferenceJson('Mein Satz'));
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="reference-saved"]').exists()).toBe(true);
    });
    expect(wrapper.get('[data-testid="reference-saved"]').text()).toContain('gespeichert');
  });

  it('lädt den mitgelieferten Satz und nennt die Quelle', async () => {
    const wrapper = mount(ColorStep);
    const source = wrapper.get('[data-testid="reference-source"]');
    expect(source.text()).toContain('keine Datei von Datacolor');
    expect(source.get('a').attributes('href')).toBe(BUNDLED_SOURCE_URL);
    expect(source.get('a').attributes('rel')).toBe('noopener noreferrer');
    await wrapper.get('[data-testid="reference-bundled"]').trigger('click');
    await flushPromises();
    expect(wrapper.get('[data-testid="reference-active"]').text()).toContain(
      `${BUNDLED_NAME} (48 Felder)`,
    );
  });

  it('lädt den aktiven Satz als Datei herunter', async () => {
    download.mockReset();
    const wrapper = mount(ColorStep);
    expect(wrapper.find('[data-testid="reference-download"]').exists()).toBe(false);
    await chooseFile(wrapper, 'a.json', dummyReferenceJson('Mein Satz'));
    await wrapper.get('[data-testid="reference-download"]').trigger('click');
    expect(download).toHaveBeenCalledWith('Mein Satz.json', expect.any(String), 'application/json');
  });

  it('importiert eine CSV-Datei', async () => {
    const wrapper = mount(ColorStep);
    await chooseFile(wrapper, 'werte.csv', dummyReferenceCsv());
    expect(wrapper.get('[data-testid="reference-active"]').text()).toContain('werte');
  });

  it('meldet fehlerhafte Dateien', async () => {
    const wrapper = mount(ColorStep);
    await chooseFile(wrapper, 'kaputt.json', '{"format":"x"}');
    expect(wrapper.get('[role="alert"]').text()).toContain('Unbekanntes Format');
  });

  it('macht ohne gewählte Datei nichts', async () => {
    const wrapper = mount(ColorStep);
    const input = wrapper.get('[data-testid="reference-file"]');
    Object.defineProperty(input.element, 'files', { value: [], configurable: true });
    await input.trigger('change');
    expect(wrapper.find('[data-testid="reference-active"]').exists()).toBe(false);
  });

  it('wechselt zwischen gespeicherten Sätzen und löscht sie', async () => {
    const wrapper = mount(ColorStep);
    await chooseFile(wrapper, 'a.json', dummyReferenceJson('Satz A'));
    await chooseFile(wrapper, 'b.json', dummyReferenceJson('Satz B'));
    expect(wrapper.get('[data-testid="reference-active"]').text()).toContain('Satz B');
    await wrapper.get('[data-testid="reference-select"]').setValue('Satz A');
    expect(wrapper.get('[data-testid="reference-active"]').text()).toContain('Satz A');
    await button(wrapper, 'Satz löschen')?.trigger('click');
    await flushPromises();
    expect(wrapper.get('[data-testid="reference-active"]').text()).toContain('Satz B');
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="reference-removed"]').exists()).toBe(true);
    });
    expect(wrapper.get('[data-testid="reference-removed"]').text()).toContain('Satz A');
    await button(wrapper, 'Satz löschen')?.trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="reference-hint"]').exists()).toBe(true);
  });

  it('lädt gespeicherte Sätze beim Öffnen', async () => {
    await useReferenceStore().importFile('a.json', dummyReferenceJson('Gespeichert'));
    setActivePinia(createPinia());
    const wrapper = mount(ColorStep);
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="reference-active"]').exists()).toBe(true);
    });
    expect(wrapper.get('[data-testid="reference-active"]').text()).toContain('Gespeichert');
  });

  it('zeigt eine Warnung, wenn der Speicher nicht funktioniert', async () => {
    setReferenceStorage(null);
    const wrapper = mount(ColorStep);
    await flushPromises();
    expect(wrapper.get('[role="status"]').text()).toContain('geladen');
  });

  it('rechnet ohne ausgewählten Referenzsatz nichts', async () => {
    const wrapper = mount(ColorStep);
    await flushPromises();
    (wrapper.vm as unknown as { compute: () => void }).compute();
    expect(useSolveStore().result).toBeNull();
    expect(useSolveStore().error).toBeNull();
  });

  it('berechnet die Farbkorrektur aus Messwerten und Referenz und zeigt den Bericht', async () => {
    const wrapper = mount(ColorStep);
    await chooseFile(wrapper, 'a.json', dummyReferenceJson());
    prepareMeasurements();
    await flushPromises();
    const compute = button(wrapper, 'Farbkorrektur berechnen');
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
    await chooseFile(wrapper, 'a.json', dummyReferenceJson());
    const chart = prepareMeasurements();
    chart.measurements = { '1A': [0.5, 0.5, 0.5] };
    await flushPromises();
    await button(wrapper, 'Farbkorrektur berechnen')?.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Zu wenige Messwerte');
    expect(wrapper.find('[data-testid="report"]').exists()).toBe(false);
  });

  it('zeigt keine eigenen Kameraoptionen (die liegen im Kamera-Tab)', () => {
    const wrapper = mount(ColorStep);
    expect(wrapper.text()).not.toContain('Aktive Auflösung');
    expect(wrapper.text()).toContain('Die Kamera ist aus');
  });
});
