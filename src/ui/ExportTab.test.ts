import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useChartStore } from '../chart/chart-store';
import { NEUTRAL_IDS } from '../chart/layouts';
import type { Rgb } from '../chart/types';
import { useSolveStore } from '../solve/solve-store';
import { parseCube } from '../test-support/cube-parse';
import { dummyIds, dummyLab } from '../test-support/dummy-reference';
import { cameraCode } from '../test-support/synthetic-camera';

import ExportTab from './ExportTab.vue';

const download = vi.hoisted(() => vi.fn());
vi.mock('../lut/download', () => ({ downloadFile: download }));

const reference = {
  name: 'Test',
  patches: Object.fromEntries(dummyIds().map((id) => [id, dummyLab(id)])),
};
const measurements: Record<string, Rgb> = Object.fromEntries(
  dummyIds().map((id) => [id, cameraCode(dummyLab(id))]),
);

function computeModel() {
  useSolveStore().compute({ measurements, reference, neutralIds: NEUTRAL_IDS });
}

describe('ExportTab', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    download.mockReset();
  });

  it('verlangt zuerst eine Farbkorrektur, zeigt aber, was man bekommt', () => {
    const wrapper = mount(ExportTab);
    expect(wrapper.get('[data-testid="export-no-model"]').text()).toContain(
      'Noch keine Farbkorrektur',
    );
    const download = wrapper.get('[data-testid="export-download"]');
    expect(download.attributes('disabled')).toBeDefined();
    expect(download.text()).toContain('cam_gradr-33.cube');
    expect(wrapper.get('[data-testid="export-size-17"]').attributes('disabled')).toBeDefined();
  });

  it('zeigt ohne Korrektur graue Schnitte und eine leere Projektliste', () => {
    const wrapper = mount(ExportTab);
    expect(wrapper.findAll('[data-testid="lut-slice-empty"]')).toHaveLength(4);
    const facts = wrapper.get('[data-testid="project-facts"]');
    expect(facts.text()).toContain('Graukarten–');
    expect(facts.text()).toContain('Korrektur–');
    expect(facts.text()).toContain('Referenz–');
  });

  it('nennt mit Korrektur die Schnitte, die Dateigröße und den Inhalt des Projekts', async () => {
    computeModel();
    useChartStore().setCards([
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ],
      [
        { x: 2, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 1 },
        { x: 2, y: 1 },
      ],
    ]);
    const wrapper = mount(ExportTab);
    expect(wrapper.findAll('[data-testid="lut-slice"]')).toHaveLength(4);
    expect(wrapper.get('[data-testid="export-file-info"]').text()).toContain(
      '33 × 33 × 33 · ca. 970 KB',
    );
    await wrapper.get('[data-testid="export-size-65"]').trigger('click');
    expect(wrapper.get('[data-testid="export-file-info"]').text()).toContain('65 × 65 × 65');
    const facts = wrapper.get('[data-testid="project-facts"]').text();
    expect(facts).toContain('8 Eckpunkte · 0 Felder');
    expect(facts).toContain('Kurven + Matrix');
  });

  it('führt mit dem Link zu den Farbkarten', async () => {
    const wrapper = mount(ExportTab);
    await wrapper.get('[data-testid="export-no-model"] button').trigger('click');
    expect(wrapper.emitted('goto')).toEqual([['color']]);
  });

  it('bietet das Projekt auch ohne Farbkorrektur an', () => {
    const wrapper = mount(ExportTab);
    expect(wrapper.get('[data-testid="project-save"]').attributes('disabled')).toBeUndefined();
    expect(wrapper.find('[data-testid="project-file"]').exists()).toBe(true);
  });

  it('lädt ohne Farbkorrektur nichts herunter', () => {
    const wrapper = mount(ExportTab);
    (wrapper.vm as unknown as { download: () => void }).download();
    expect(download).not.toHaveBeenCalled();
  });

  it('bietet die Größen 17, 33 und 65 mit 33 als Standard an', () => {
    computeModel();
    const wrapper = mount(ExportTab);
    const radios = wrapper.findAll('[role="radio"]');
    expect(radios.map((radio) => radio.text())).toEqual(['17³', '33³ Standard', '65³']);
    expect(radios.map((radio) => radio.attributes('aria-checked'))).toEqual([
      'false',
      'true',
      'false',
    ]);
    expect(wrapper.get('[data-testid="export-download"]').text()).toContain('cam_gradr-33.cube');
    expect(wrapper.find('[data-testid="export-no-model"]').exists()).toBe(false);
  });

  it('lädt eine gültige .cube-Datei in der gewählten Größe herunter', async () => {
    computeModel();
    const wrapper = mount(ExportTab);
    await wrapper.get('[data-testid="export-size-17"]').trigger('click');
    await wrapper.get('[data-testid="export-download"]').trigger('click');

    expect(download).toHaveBeenCalledTimes(1);
    const [name, content, mime] = download.mock.calls[0] as [string, string, string];
    expect(name).toBe('cam_gradr-17.cube');
    expect(mime).toBe('text/plain');
    const parsed = parseCube(content);
    expect(parsed.lut.size).toBe(17);
    expect(parsed.lut.data).toHaveLength(17 ** 3 * 3);
    expect(parsed.title).toBe('cam_gradr');
  });

  it('schreibt die volle Korrektur in die LUT', async () => {
    computeModel();
    const wrapper = mount(ExportTab);
    await wrapper.get('[data-testid="export-download"]').trigger('click');
    const lut = parseCube((download.mock.calls[0] as [string, string, string])[1]);
    // Der Knoten (r = 1/32 der Skala) wird von der Korrektur verändert, er bleibt nicht auf der Identität.
    const index = 3 * (1 + 33 * 5 + 33 * 33 * 9);
    expect(lut.lut.data[index]).not.toBeCloseTo(1 / 32, 3);
  });

  it('zeigt nach dem Herunterladen keine Meldung', async () => {
    computeModel();
    const wrapper = mount(ExportTab);
    await wrapper.get('[data-testid="export-download"]').trigger('click');
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
  });
});
