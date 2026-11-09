// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import type { VueWrapper } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import LookPicker from './LookPicker.vue';

// The picker with three looks; the chosen look follows v-model like in the bar.
function picker(chosen: string | null = 'Cold') {
  let current = chosen;
  const wrapper: VueWrapper = mount(LookPicker, {
    props: {
      names: ['Cold', 'Teal', 'Warm'],
      noneText: 'Keine Look-LUT',
      importText: '+ Look-LUT importieren …',
      modelValue: chosen,
      'onUpdate:modelValue': (value: string | null) => {
        current = value;
        return wrapper.setProps({ modelValue: value });
      },
    },
  });
  const box = wrapper.get('[data-testid="look-select"]');
  const press = (key: string, options: { altKey?: boolean } = {}) =>
    box.trigger('keydown', { key, ...options });
  const value = () => current;
  const active = () => box.attributes('aria-activedescendant');
  return { wrapper, box, press, value, active };
}

describe('LookPicker', () => {
  it('shows the chosen look, or the first entry without one', () => {
    expect(picker().box.text()).toBe('Cold');
    expect(picker(null).box.text()).toBe('Keine Look-LUT');
  });

  it('applies every arrow step at once while closed and leaves out the import', async () => {
    const { press, value, box } = picker();
    await press('ArrowDown');
    expect(value()).toBe('Teal');
    await press('ArrowDown');
    await press('ArrowDown');
    expect(value()).toBe('Warm');
    await press('ArrowUp');
    expect(value()).toBe('Teal');
    await press('Home');
    expect(value()).toBeNull();
    await press('ArrowUp');
    expect(value()).toBeNull();
    await press('End');
    expect(value()).toBe('Warm');
    expect(box.attributes('aria-expanded')).toBe('false');
  });

  it('applies the highlighted look while the list is open; Escape goes back', async () => {
    const { press, value, active, wrapper } = picker();
    await press('Enter');
    expect(wrapper.find('[data-testid="look-list"]').exists()).toBe(true);
    expect(active()).toBe('look-option-1');
    await press('ArrowDown');
    expect(value()).toBe('Teal');
    expect(active()).toBe('look-option-2');
    await press('ArrowDown');
    await press('ArrowUp');
    expect(value()).toBe('Teal');
    await press('ArrowDown');
    await press('ArrowDown');
    // The import entry only highlights, the look stays.
    expect(active()).toBe('look-option-4');
    expect(value()).toBe('Warm');
    await press('Escape');
    expect(value()).toBe('Cold');
    expect(wrapper.find('[data-testid="look-list"]').exists()).toBe(false);
    await press('Escape');
    expect(value()).toBe('Cold');
  });

  it('takes the highlighted entry with Enter or Space and runs the import only then', async () => {
    const { press, value, wrapper } = picker();
    await press(' ');
    await press('ArrowDown');
    await press(' ');
    expect(value()).toBe('Teal');
    expect(wrapper.find('[data-testid="look-list"]').exists()).toBe(false);

    await press('ArrowDown', { altKey: true });
    await press('End');
    expect(value()).toBe('Teal');
    await press('Enter');
    expect(wrapper.emitted('import')).toHaveLength(1);
    expect(value()).toBe('Teal');
  });

  it('goes back to the look from before when the import is chosen after browsing', async () => {
    const { press, value, wrapper } = picker();
    await press('Enter');
    await press('ArrowDown');
    await press('ArrowDown');
    await press('ArrowDown');
    expect(value()).toBe('Warm');
    await press('ArrowDown');
    await press('Enter');
    expect(value()).toBe('Cold');
    expect(wrapper.emitted('import')).toHaveLength(1);
  });

  it('opens and closes with a click, takes a clicked entry and closes when the focus leaves', async () => {
    const { box, value, wrapper } = picker();
    await box.trigger('click');
    const options = wrapper.findAll('[role="option"]');
    expect(options.map((option) => option.text())).toEqual([
      'Keine Look-LUT',
      'Cold',
      'Teal',
      'Warm',
      '+ Look-LUT importieren …',
    ]);
    expect(options[1]?.attributes('aria-selected')).toBe('true');
    await options[3]?.trigger('mousedown');
    await options[3]?.trigger('click');
    expect(value()).toBe('Warm');
    expect(wrapper.find('[data-testid="look-list"]').exists()).toBe(false);

    await box.trigger('click');
    await box.trigger('click');
    expect(wrapper.find('[data-testid="look-list"]').exists()).toBe(false);
    await box.trigger('click');
    await box.trigger('blur');
    expect(wrapper.find('[data-testid="look-list"]').exists()).toBe(false);
  });

  it('scrolls only the list to the highlighted entry', async () => {
    const { press, wrapper } = picker(null);
    await press('Enter');
    // Five entries of 20 px in a list that shows 50 px.
    const list = wrapper.get('[data-testid="look-list"]').element as HTMLElement;
    Object.defineProperty(list, 'clientHeight', { value: 50 });
    for (const [index, item] of [...list.children].entries()) {
      Object.defineProperties(item, {
        offsetTop: { value: index * 20 },
        offsetHeight: { value: 20 },
      });
    }
    await press('ArrowDown');
    await press('ArrowDown');
    await press('ArrowDown');
    expect(list.scrollTop).toBe(30);
    await press('Home');
    expect(list.scrollTop).toBe(0);
  });

  it('ignores other keys', async () => {
    const { press, value } = picker();
    await press('a');
    expect(value()).toBe('Cold');
  });
});
