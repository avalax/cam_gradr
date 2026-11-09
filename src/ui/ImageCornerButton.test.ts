// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import ImageCornerButton from './ImageCornerButton.vue';

describe('ImageCornerButton', () => {
  it('puts the button in the image toolbar and gives it what the caller passes', async () => {
    const onClick = vi.fn();
    const wrapper = mount(ImageCornerButton, {
      props: { label: 'Löschen', title: 'Alles löschen' },
      attrs: { disabled: false, 'data-testid': 'action', onClick },
      slots: { default: '<path d="M4 7h16" />' },
    });
    const toolbar = wrapper.get('[role="toolbar"]');
    expect(toolbar.attributes('aria-label')).toBe('Bildaktionen');
    expect(toolbar.attributes('data-testid')).toBeUndefined();
    const button = wrapper.get('[data-testid="action"]');
    expect(button.element.tagName).toBe('BUTTON');
    expect(button.attributes('aria-label')).toBe('Löschen');
    expect(button.attributes('title')).toBe('Alles löschen');
    await button.trigger('click');
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
