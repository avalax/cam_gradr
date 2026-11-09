// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import { syntheticFit } from '../test-support/synthetic-camera';

import ResultReport from './ResultReport.vue';

const result = syntheticFit();

describe('ResultReport', () => {
  it('shows mean and largest error before and after, also per kind of patch', () => {
    const report = {
      ...result.report,
      meanBefore: 12.34,
      meanAfter: 1.06,
      maxBefore: 30.17,
      maxAfter: 4.94,
      neutral: { count: 12, meanBefore: 8.2, meanAfter: 0.71 },
      color: { count: 36, meanBefore: 13.66, meanAfter: 1.2 },
    };
    const wrapper = mount(ResultReport, {
      props: { result: { ...result, report }, grayCheck: [] },
    });
    const text = (id: string) => wrapper.get(`[data-testid="${id}"]`).text();
    expect(text('mean-before')).toBe('12,3');
    expect(text('mean-after')).toBe('1,1');
    expect(text('max-before')).toBe('30,2');
    expect(text('max-after')).toBe('4,9');
    expect(text('neutral-after')).toBe('0,7');
    expect(text('color-before')).toBe('13,7');
  });

  it('shows every patch with three swatches and its error', () => {
    const wrapper = mount(ResultReport, { props: { result, grayCheck: [] } });
    expect(wrapper.findAll('li')).toHaveLength(48);
    const tile = wrapper.get('[data-testid="tile-3A"]');
    expect(tile.attributes('title')).toContain('3A: ΔE');
    expect(tile.findAll('span[style]')).toHaveLength(3);
    for (const swatch of tile.findAll('span[style]')) {
      expect(swatch.attributes('style')).toMatch(/background: rgb\(\d+, \d+, \d+\)/);
    }
  });

  it('warns about compressed highlights only when neutral patches are indistinguishable', async () => {
    const wrapper = mount(ResultReport, { props: { result, grayCheck: [] } });
    expect(wrapper.find('[data-testid="indistinct-warning"]').exists()).toBe(false);
    await wrapper.setProps({
      result: { ...result, report: { ...result.report, indistinct: ['2E', '2D'] } },
    });
    expect(wrapper.get('[data-testid="indistinct-warning"]').text()).toContain('2E, 2D');
  });

  it('shows no gray card section without check values', () => {
    const wrapper = mount(ResultReport, { props: { result, grayCheck: [] } });
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
