// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import ChoiceChips from './ChoiceChips.vue';

const SIZES = [
  { key: 'small', value: { width: 640 }, label: 'Klein' },
  { key: 'large', value: { width: 1920 }, label: 'Groß', lang: 'de' },
];

describe('ChoiceChips', () => {
  it('shows the options as radio buttons and checks the selected one', () => {
    const wrapper = mount(ChoiceChips, {
      props: { options: SIZES, selected: 'large' },
      attrs: { 'aria-label': 'Größe' },
    });
    const group = wrapper.get('[role="radiogroup"]');
    expect(group.attributes('aria-label')).toBe('Größe');
    const radios = wrapper.findAll('[role="radio"]');
    expect(radios.map((radio) => radio.text())).toEqual(['Klein', 'Groß']);
    expect(radios.map((radio) => radio.attributes('aria-checked'))).toEqual(['false', 'true']);
    expect(radios.map((radio) => radio.attributes('lang'))).toEqual([undefined, 'de']);
    expect(radios.map((radio) => radio.attributes('disabled'))).toEqual([undefined, undefined]);
  });

  it('reports the value of the chosen option', async () => {
    const wrapper = mount(ChoiceChips, { props: { options: SIZES, selected: 'large' } });
    await wrapper.get('[data-option="small"]').trigger('click');
    expect(wrapper.emitted('choose')).toEqual([[{ width: 640 }]]);
  });

  it('can lock one option, and shows the segmented control grayed out while disabled', async () => {
    const options = SIZES.map((option, index) => ({ ...option, disabled: index === 1 }));
    const wrapper = mount(ChoiceChips, {
      props: { options, selected: 'small', variant: 'segmented' },
    });
    const radios = wrapper.findAll('[role="radio"]');
    expect(radios.map((radio) => radio.attributes('disabled'))).toEqual([undefined, '']);
    expect(wrapper.get('[role="radiogroup"]').classes()).not.toContain('opacity-50');
    await wrapper.setProps({ disabled: true });
    expect(wrapper.get('[role="radiogroup"]').classes()).toContain('opacity-50');
  });

  it('locks all options while disabled', () => {
    const wrapper = mount(ChoiceChips, {
      props: { options: SIZES, selected: 'small', disabled: true },
    });
    for (const radio of wrapper.findAll('[role="radio"]')) {
      expect(radio.attributes('disabled')).toBeDefined();
    }
  });
});
