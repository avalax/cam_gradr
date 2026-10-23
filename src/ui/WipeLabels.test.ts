import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import WipeLabels from './WipeLabels.vue';

const labels = (split: number) => mount(WipeLabels, { props: { split } });

describe('WipeLabels', () => {
  it('names both sides and puts the line where the divider is', () => {
    const wrapper = labels(50);
    expect(wrapper.text()).toBe('KameraKorrigiert');
    expect(wrapper.get('[data-testid="labels-line"]').attributes('style')).toContain('left: 50%');
  });

  it('follows the divider: a narrow side keeps only its dot', () => {
    const wrapper = labels(15);
    expect(wrapper.text()).toBe('Korrigiert');
    expect(wrapper.findAll('i')).toHaveLength(3);
    const right = labels(85);
    expect(right.text()).toBe('Kamera');
    expect(right.findAll('i')).toHaveLength(3);
  });

  it('shows only one side when the divider is at the edge', () => {
    const left = labels(0);
    expect(left.text()).toBe('Korrigiert');
    expect(left.findAll('i')).toHaveLength(2);
    const right = labels(100);
    expect(right.text()).toBe('Kamera');
    expect(right.findAll('i')).toHaveLength(2);
  });
});
