// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import { NEUTRAL_IDS } from '../chart/layouts';
import type { Rgb } from '../chart/types';
import { fitColorModel } from '../solve/fit';
import { dummyIds, dummyLab } from '../test-support/dummy-reference';
import { cameraCode } from '../test-support/synthetic-camera';

import ResultReport from './ResultReport.vue';

const reference = {
  name: 'Test',
  patches: Object.fromEntries(dummyIds().map((id) => [id, dummyLab(id)])),
};
const measurements: Record<string, Rgb> = Object.fromEntries(
  dummyIds().map((id) => [id, cameraCode(dummyLab(id))]),
);
const result = fitColorModel({ measurements, reference, neutralIds: NEUTRAL_IDS });

describe('ResultReport', () => {
  it('shows mean and largest error before and after, also per kind of patch', () => {
    const wrapper = mount(ResultReport, { props: { result } });
    expect(wrapper.get('[data-testid="mean-before"]').text()).toBe(
      result.report.meanBefore.toFixed(1).replace('.', ','),
    );
    expect(wrapper.get('[data-testid="mean-after"]').text()).toBe(
      result.report.meanAfter.toFixed(1).replace('.', ','),
    );
    expect(wrapper.get('[data-testid="max-before"]').text()).toBe(
      result.report.maxBefore.toFixed(1).replace('.', ','),
    );
    expect(wrapper.get('[data-testid="max-after"]').text()).toBe(
      result.report.maxAfter.toFixed(1).replace('.', ','),
    );
    // Separately for neutral and color patches.
    expect(wrapper.get('[data-testid="neutral-after"]').text()).toBe(
      result.report.neutral?.meanAfter.toFixed(1).replace('.', ','),
    );
    expect(wrapper.get('[data-testid="color-before"]').text()).toBe(
      result.report.color?.meanBefore.toFixed(1).replace('.', ','),
    );
  });

  it('shows three color patches with the error per patch', () => {
    const wrapper = mount(ResultReport, { props: { result } });
    expect(wrapper.findAll('li')).toHaveLength(48);
    const tile = wrapper.get('[data-testid="tile-3A"]');
    expect(tile.attributes('title')).toContain('3A: ΔE');
    expect(tile.findAll('span[style]')).toHaveLength(3);
    for (const swatch of tile.findAll('span[style]')) {
      expect(swatch.attributes('style')).toMatch(/background: rgb\(\d+, \d+, \d+\)/);
    }
  });

  it('warns about compressed highlights only when neutral patches are indistinguishable', async () => {
    const wrapper = mount(ResultReport, { props: { result } });
    expect(wrapper.find('[data-testid="indistinct-warning"]').exists()).toBe(false);
    await wrapper.setProps({
      result: { ...result, report: { ...result.report, indistinct: ['2E', '2D'] } },
    });
    expect(wrapper.get('[data-testid="indistinct-warning"]').text()).toContain('2E, 2D');
  });

  it('shows no gray card section without check values', () => {
    const wrapper = mount(ResultReport, { props: { result } });
    expect(wrapper.find('[data-testid="gray-check"]').exists()).toBe(false);
  });

  it('shows the gray card check and only warns on large deviation', async () => {
    const wrapper = mount(ResultReport, {
      props: {
        result,
        grayCheck: [
          { id: 'G50', before: 4, after: 0.8 },
          { id: 'X', before: 1, after: 1 },
        ],
      },
    });
    expect(wrapper.get('[data-testid="gray-G50"]').text()).toBe('Graukarte 50 %: 4,0 → 0,8');
    expect(wrapper.get('[data-testid="gray-X"]').text()).toContain('X: 1,0 → 1,0');
    expect(wrapper.find('[data-testid="gray-warning"]').exists()).toBe(false);
    await wrapper.setProps({ grayCheck: [{ id: 'G18', before: 5, after: 3.5 }] });
    expect(wrapper.get('[data-testid="gray-warning"]').text()).toContain('Licht');
  });
});
