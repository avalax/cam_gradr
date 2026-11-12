// @vitest-environment happy-dom
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

  it('follows the divider: a narrow side drops its name', () => {
    expect(labels(15).text()).toBe('Korrigiert');
    expect(labels(85).text()).toBe('Kamera');
    expect(labels(0).text()).toBe('Korrigiert');
    expect(labels(100).text()).toBe('Kamera');
  });

  it('takes other names for both sides', () => {
    const wrapper = mount(WipeLabels, {
      props: { split: 50, leftLabel: 'Korrigiert', rightLabel: 'Korrigiert + Look-LUT 70 %' },
    });
    expect(wrapper.text()).toBe('KorrigiertKorrigiert + Look-LUT 70 %');
  });

  it('makes both halves buttons that switch their side and say what a click shows', async () => {
    const wrapper = mount(WipeLabels, {
      props: {
        split: 50,
        rightLabel: 'Kamera + Look-LUT 70 %',
        switchable: true,
        leftTip: 'Klicken: korrigiert zeigen',
        rightTip: 'Klicken: Look-LUT mit Korrektur',
      },
    });
    const left = wrapper.get('[data-testid="labels-left"]');
    const right = wrapper.get('[data-testid="labels-right"]');
    expect(left.element.tagName).toBe('BUTTON');
    expect(left.attributes('title')).toBe('Klicken: korrigiert zeigen');
    expect(right.attributes('aria-label')).toBe(
      'Kamera + Look-LUT 70 %. Klicken: Look-LUT mit Korrektur',
    );
    await left.trigger('click');
    await right.trigger('click');
    expect(wrapper.emitted('switch')).toEqual([['left'], ['right']]);
  });

  it('keeps plain labels that ignore clicks unless switchable', async () => {
    const wrapper = labels(50);
    const left = wrapper.get('[data-testid="labels-left"]');
    expect(left.element.tagName).toBe('SPAN');
    expect(left.attributes('title')).toBeUndefined();
    await left.trigger('click');
    expect(wrapper.emitted('switch')).toBeUndefined();
    const named = mount(WipeLabels, { props: { split: 50, switchable: true } });
    expect(named.get('[data-testid="labels-left"]').attributes('aria-label')).toBe('Kamera');
  });
});
