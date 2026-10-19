import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import type { ColorModel } from '../solve/fit';

import LutSlices from './LutSlices.vue';

const model: ColorModel = {
  curves: [
    { xs: [0, 1], ys: [0, 1] },
    { xs: [0, 1], ys: [0, 1] },
    { xs: [0, 1], ys: [0, 1] },
  ],
  matrix: [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
};

describe('LutSlices', () => {
  it('zeigt ohne Korrektur vier graue Felder', () => {
    const wrapper = mount(LutSlices, { props: { model: null } });
    expect(wrapper.findAll('[data-testid="lut-slice-empty"]')).toHaveLength(4);
    expect(wrapper.find('[data-testid="lut-slice"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="lut-slices"]').attributes('data-ready')).toBe('false');
  });

  it('zeigt mit Korrektur vier Schnitte mit je 64 gefärbten Zellen', () => {
    const wrapper = mount(LutSlices, { props: { model } });
    const slices = wrapper.findAll('[data-testid="lut-slice"]');
    expect(slices).toHaveLength(4);
    expect(slices[0]?.findAll('i')).toHaveLength(64);
    expect(slices[0]?.find('i').attributes('style')).toContain('background');
    expect(wrapper.get('[data-testid="lut-slices"]').attributes('data-ready')).toBe('true');
  });
});
