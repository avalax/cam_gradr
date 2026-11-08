// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import IconButton from './IconButton.vue';

describe('IconButton', () => {
  it('names the button and uses the name as title unless it has its own', async () => {
    const onClick = vi.fn();
    const wrapper = mount(IconButton, {
      props: { label: 'Löschen' },
      attrs: { onClick, 'data-testid': 'action' },
      slots: { default: '<path d="M4 7h16" />' },
    });
    const button = wrapper.get('[data-testid="action"]');
    expect(button.attributes('type')).toBe('button');
    expect(button.attributes('aria-label')).toBe('Löschen');
    expect(button.attributes('title')).toBe('Löschen');
    expect(button.get('svg path').attributes('d')).toBe('M4 7h16');
    await button.trigger('click');
    expect(onClick).toHaveBeenCalledTimes(1);
    await wrapper.setProps({ title: 'Alles löschen' });
    expect(button.attributes('title')).toBe('Alles löschen');
  });

  it('fills the image toolbar or fits a bar', async () => {
    const wrapper = mount(IconButton, { props: { label: 'Löschen' } });
    expect(wrapper.classes()).toContain('h-9');
    await wrapper.setProps({ size: 'sm' });
    expect(wrapper.classes()).toContain('size-[26px]');
  });
});
