// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import { IDENTITY_MODEL } from '../test-support/identity-model';

import LutSlices from './LutSlices.vue';

const model = IDENTITY_MODEL;

describe('LutSlices', () => {
  it('shows four gray fields without a correction', () => {
    const wrapper = mount(LutSlices, { props: { model: null } });
    expect(wrapper.findAll('[data-testid="lut-slice-empty"]')).toHaveLength(8);
    expect(wrapper.find('[data-testid="lut-slice"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="lut-slices"]').attributes('data-ready')).toBe('false');
  });

  it('shows eight slices of 64 colored cells each with a correction', () => {
    const wrapper = mount(LutSlices, { props: { model } });
    const slices = wrapper.findAll('[data-testid="lut-slice"]');
    expect(slices).toHaveLength(8);
    expect(slices[0]?.findAll('i')).toHaveLength(64);
    expect(slices[0]?.find('i').attributes('style')).toContain('background');
    expect(wrapper.get('[data-testid="lut-slices"]').attributes('data-ready')).toBe('true');
  });
});
