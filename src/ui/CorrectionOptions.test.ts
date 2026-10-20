import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { NEUTRAL_IDS } from '../chart/layouts';
import type { Rgb } from '../chart/types';
import { useSolveStore } from '../solve/solve-store';
import { dummyIds, dummyLab } from '../test-support/dummy-reference';
import { cameraCode } from '../test-support/synthetic-camera';

import CorrectionOptions from './CorrectionOptions.vue';
import ExportTab from './ExportTab.vue';
import PreviewTab from './PreviewTab.vue';

const reference = {
  name: 'Test',
  patches: Object.fromEntries(dummyIds().map((id) => [id, dummyLab(id)])),
};
const measurements: Record<string, Rgb> = Object.fromEntries(
  dummyIds().map((id) => [id, cameraCode(dummyLab(id))]),
);

describe('CorrectionOptions', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('shows the tone setting as disabled until a correction is computed', () => {
    const wrapper = mount(CorrectionOptions);
    const box = wrapper.get<HTMLInputElement>('[data-testid="correction-tone"]');
    expect(box.element.disabled).toBe(true);
    expect(box.element.checked).toBe(true);
    expect(box.element.closest('label')?.getAttribute('title')).toContain('neuen Berechnung');
    expect(wrapper.get('[data-testid="correction-summary"]').text()).toContain(
      'Farbe + Kontrast und Gamma',
    );
  });

  it('switches the tone correction of the model', async () => {
    const solve = useSolveStore();
    solve.compute({ measurements, reference, neutralIds: NEUTRAL_IDS });
    const wrapper = mount(CorrectionOptions);
    const box = wrapper.get<HTMLInputElement>('[data-testid="correction-tone"]');
    expect(box.element.disabled).toBe(false);
    expect(box.element.closest('label')?.getAttribute('title')).toBeNull();
    await box.setValue(false);
    expect(solve.tone).toBe(false);
    expect(solve.model?.curves[0].xs).toHaveLength(3);
    expect(wrapper.get('[data-testid="correction-summary"]').text()).toBe('Aktiv: Farbe');
    await box.setValue(true);
    expect(solve.model?.curves[0].xs.length).toBeGreaterThan(2);
  });

  it('is one setting for the preview and the export', async () => {
    const solve = useSolveStore();
    solve.compute({ measurements, reference, neutralIds: NEUTRAL_IDS });
    const preview = mount(PreviewTab);
    const exportTab = mount(ExportTab);
    await preview.get('[data-testid="correction-tone"]').setValue(false);
    const other = exportTab.get<HTMLInputElement>('[data-testid="correction-tone"]');
    expect(other.element.checked).toBe(false);
    await other.setValue(true);
    expect(preview.get<HTMLInputElement>('[data-testid="correction-tone"]').element.checked).toBe(
      true,
    );
  });
});

describe('CorrectionOptions (compact)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('keeps the explanations as tooltips instead of text', () => {
    const solve = useSolveStore();
    solve.compute({ measurements, reference, neutralIds: NEUTRAL_IDS });
    const wrapper = mount(CorrectionOptions, { props: { compact: true } });
    expect(wrapper.find('small').exists()).toBe(false);
    expect(wrapper.find('[data-testid="correction-summary"]').exists()).toBe(false);
    const labels = wrapper.findAll('label');
    expect(labels[0]?.attributes('title')).toContain('Immer aktiv');
    expect(labels[1]?.attributes('title')).toContain('Tonwertkurve');
  });
});
