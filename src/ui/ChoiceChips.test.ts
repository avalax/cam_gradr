// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';

import ChoiceChips from './ChoiceChips.vue';

const SIZES = [
  { key: 'small', value: { width: 640 }, label: 'Klein' },
  { key: 'large', value: { width: 1920 }, label: 'Groß', lang: 'de' },
];

const THREE = [
  { key: 'a', value: 'A', label: 'Eins' },
  { key: 'b', value: 'B', label: 'Zwei', disabled: true },
  { key: 'c', value: 'C', label: 'Drei' },
];

describe('ChoiceChips', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

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

  it('shows cards with a detail and a hint', () => {
    const options = SIZES.map((option, index) => ({
      ...option,
      detail: `${String(index + 1)} MB`,
      hint: index === 0 ? 'klein' : 'groß',
    }));
    const wrapper = mount(ChoiceChips, {
      props: { options, selected: 'large', variant: 'cards' },
    });
    const radios = wrapper.findAll('[role="radio"]');
    expect(radios.map((radio) => radio.text())).toEqual(['Klein1 MBklein', 'Groß2 MBgroß']);
    expect(radios[1]?.classes()).toContain('border-2');
  });

  it('locks all options while disabled', () => {
    const wrapper = mount(ChoiceChips, {
      props: { options: SIZES, selected: 'small', disabled: true },
    });
    for (const radio of wrapper.findAll('[role="radio"]')) {
      expect(radio.attributes('disabled')).toBeDefined();
    }
  });

  it('is one stop of the Tab key: the chosen option, else the first that can be chosen', async () => {
    const wrapper = mount(ChoiceChips, { props: { options: THREE, selected: 'c' } });
    const stops = () =>
      wrapper.findAll('[role="radio"]').map((radio) => radio.attributes('tabindex'));
    expect(stops()).toEqual(['-1', '-1', '0']);
    await wrapper.setProps({ selected: 'b' });
    expect(stops()).toEqual(['0', '-1', '-1']);
    await wrapper.setProps({ disabled: true });
    expect(stops()).toEqual(['-1', '-1', '-1']);
  });

  it('chooses the next option with the arrow keys and skips locked ones', async () => {
    const wrapper = mount(ChoiceChips, {
      props: { options: THREE, selected: 'a' },
      attachTo: document.body,
    });
    const radios = wrapper.findAll('[role="radio"]');
    await radios[0]?.trigger('keydown', { key: 'ArrowRight' });
    expect(wrapper.emitted('choose')).toEqual([['C']]);
    expect(document.activeElement).toBe(radios[2]?.element);
    await radios[2]?.trigger('keydown', { key: 'Enter' });
    expect(wrapper.emitted('choose')).toHaveLength(1);
    wrapper.unmount();
  });

  it('fills a narrow band in small type when compact', () => {
    const wrapper = mount(ChoiceChips, {
      props: { options: SIZES, selected: 'small', variant: 'segmented', compact: true },
    });
    expect(wrapper.get('[role="radiogroup"]').classes()).toContain('w-full');
    expect(wrapper.get('[role="radio"]').classes()).toContain('flex-1');
  });

  it('draws the focus ring inside the segmented controls, which clip their corners', () => {
    for (const compact of [false, true]) {
      const wrapper = mount(ChoiceChips, {
        props: { options: SIZES, selected: 'small', variant: 'segmented', compact },
      });
      expect(wrapper.get('[role="radiogroup"]').classes()).toContain('overflow-hidden');
      expect(wrapper.get('[role="radio"]').classes()).toContain('focus-ring-inset');
    }
  });
});
