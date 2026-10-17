import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NEUTRAL_IDS } from '../chart/layouts';
import type { Rgb } from '../chart/types';
import { usePreviewStore } from '../lut/preview-store';
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

  it('verlangt zuerst eine Farbkorrektur', () => {
    const wrapper = mount(ExportTab);
    expect(wrapper.get('[data-testid="export-no-model"]').text()).toContain(
      'noch keine Farbkorrektur',
    );
    expect(wrapper.find('[data-testid="export-download"]').exists()).toBe(false);
  });

  it('lädt ohne Farbkorrektur nichts herunter', () => {
    const wrapper = mount(ExportTab);
    (wrapper.vm as unknown as { download: () => void }).download();
    expect(download).not.toHaveBeenCalled();
  });

  it('bietet die Größen 17, 33 und 65 mit 33 als Standard an', () => {
    computeModel();
    const wrapper = mount(ExportTab);
    const select = wrapper.get('[data-testid="export-size"]');
    expect(select.findAll('option').map((option) => option.text())).toEqual([
      '17³',
      '33³ (Standard)',
      '65³',
    ]);
    expect((select.element as HTMLSelectElement).value).toBe('33');
    expect(wrapper.get('[data-testid="export-download"]').text()).toContain('cam_gradr-33.cube');
    expect(wrapper.get('[data-testid="export-strength"]').text()).toContain('100 %');
    expect(wrapper.find('[data-testid="export-no-model"]').exists()).toBe(false);
  });

  it('lädt eine gültige .cube-Datei in der gewählten Größe herunter', async () => {
    computeModel();
    const wrapper = mount(ExportTab);
    await wrapper.get('[data-testid="export-size"]').setValue('17');
    await wrapper.get('[data-testid="export-download"]').trigger('click');

    expect(download).toHaveBeenCalledTimes(1);
    const [name, content, mime] = download.mock.calls[0] as [string, string, string];
    expect(name).toBe('cam_gradr-17.cube');
    expect(mime).toBe('text/plain');
    const parsed = parseCube(content);
    expect(parsed.lut.size).toBe(17);
    expect(parsed.lut.data).toHaveLength(17 ** 3 * 3);
    expect(parsed.title).toContain('Stärke 100 %');
    expect(wrapper.get('[data-testid="export-saved"]').text()).toContain('cam_gradr-17.cube');
  });

  it('rechnet die Stärke aus der Vorschau fest in die LUT ein', async () => {
    computeModel();
    const wrapper = mount(ExportTab);
    await wrapper.get('[data-testid="export-download"]').trigger('click');
    const full = parseCube((download.mock.calls[0] as [string, string, string])[1]);

    usePreviewStore().setStrength(0);
    await wrapper.get('[data-testid="export-download"]').trigger('click');
    const none = parseCube((download.mock.calls[1] as [string, string, string])[1]);

    // Stärke 0 ergibt die Identität: der Knoten (r = 1/32 der Skala) bleibt unverändert.
    const index = 3 * (1 + 33 * 5 + 33 * 33 * 9);
    expect(none.lut.data[index]).toBeCloseTo(1 / 32, 5);
    expect(none.lut.data[index + 1]).toBeCloseTo(5 / 32, 5);
    expect(none.lut.data[index + 2]).toBeCloseTo(9 / 32, 5);
    expect(full.lut.data[index]).not.toBeCloseTo(1 / 32, 3);
    expect(none.title).toContain('Stärke 0 %');
  });

  it('meldet den Dateinamen erst nach dem Herunterladen und blendet ihn bei Änderung der Größe aus', async () => {
    computeModel();
    const wrapper = mount(ExportTab);
    expect(wrapper.find('[data-testid="export-saved"]').exists()).toBe(false);
    await wrapper.get('[data-testid="export-download"]').trigger('click');
    expect(wrapper.find('[data-testid="export-saved"]').exists()).toBe(true);
    await wrapper.get('[data-testid="export-size"]').setValue('65');
    expect(wrapper.find('[data-testid="export-saved"]').exists()).toBe(false);
  });
});
