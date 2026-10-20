import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import WipeDivider from './WipeDivider.vue';

function mountDivider(modelValue = 50) {
  const wrapper = mount(WipeDivider, {
    props: {
      modelValue,
      label: 'Wischer',
      'onUpdate:modelValue': (value: number) => wrapper.setProps({ modelValue: value }),
    },
  });
  const element = wrapper.get('[data-testid="wipe"]').element as HTMLElement;
  element.getBoundingClientRect = () => ({ left: 100, width: 200 }) as DOMRect;
  element.setPointerCapture = vi.fn();
  element.hasPointerCapture = vi.fn(() => true);
  return wrapper;
}

function lastValue(wrapper: ReturnType<typeof mountDivider>): number {
  return wrapper.props('modelValue');
}

describe('WipeDivider', () => {
  it('shows line and handle at the current position and describes itself as a slider', () => {
    const wrapper = mountDivider(30);
    expect(wrapper.get('[data-testid="wipe-line"]').attributes('style')).toContain('left: 30%');
    expect(wrapper.get('[data-testid="wipe-grip"]').attributes('style')).toContain('left: 30%');
    const area = wrapper.get('[data-testid="wipe"]');
    expect(area.attributes('role')).toBe('slider');
    expect(area.attributes('aria-valuenow')).toBe('30');
    expect(area.attributes('aria-valuetext')).toBe('30 % Original');
    expect(area.attributes('aria-label')).toBe('Wischer');
    expect(area.attributes('tabindex')).toBe('0');
  });

  it('sets the line to the pointer position on click and drag', async () => {
    const wrapper = mountDivider();
    const area = wrapper.get('[data-testid="wipe"]');
    await area.trigger('pointerdown', { clientX: 150, pointerId: 1 });
    expect(lastValue(wrapper)).toBe(25);
    await area.trigger('pointermove', { clientX: 250, pointerId: 1 });
    expect(lastValue(wrapper)).toBe(75);
    await area.trigger('pointermove', { clientX: 1000, pointerId: 1 });
    expect(lastValue(wrapper)).toBe(100);
    await area.trigger('pointermove', { clientX: -500, pointerId: 1 });
    expect(lastValue(wrapper)).toBe(0);
  });

  it('follows the pointer only while it is pressed', async () => {
    const wrapper = mountDivider();
    const element = wrapper.get('[data-testid="wipe"]').element as HTMLElement;
    element.hasPointerCapture = vi.fn(() => false);
    await wrapper
      .get('[data-testid="wipe"]')
      .trigger('pointermove', { clientX: 250, pointerId: 1 });
    expect(lastValue(wrapper)).toBe(50);
  });

  it('ignores pointer moves while the surface has no width', async () => {
    const wrapper = mountDivider();
    const element = wrapper.get('[data-testid="wipe"]').element as HTMLElement;
    element.getBoundingClientRect = () => ({ left: 0, width: 0 }) as DOMRect;
    await wrapper.get('[data-testid="wipe"]').trigger('pointerdown', { clientX: 10, pointerId: 1 });
    expect(lastValue(wrapper)).toBe(50);
  });

  it('moves with the arrow keys, in larger steps with Shift', async () => {
    const wrapper = mountDivider();
    const area = wrapper.get('[data-testid="wipe"]');
    await area.trigger('keydown', { key: 'ArrowRight' });
    expect(lastValue(wrapper)).toBe(51);
    await area.trigger('keydown', { key: 'ArrowUp' });
    expect(lastValue(wrapper)).toBe(52);
    await area.trigger('keydown', { key: 'ArrowLeft' });
    await area.trigger('keydown', { key: 'ArrowDown' });
    expect(lastValue(wrapper)).toBe(50);
    await area.trigger('keydown', { key: 'ArrowLeft', shiftKey: true });
    expect(lastValue(wrapper)).toBe(40);
    await area.trigger('keydown', { key: 'ArrowRight', shiftKey: true });
    expect(lastValue(wrapper)).toBe(50);
  });

  it('jumps to the edge with Home and End and stays on the surface', async () => {
    const wrapper = mountDivider();
    const area = wrapper.get('[data-testid="wipe"]');
    await area.trigger('keydown', { key: 'Home' });
    expect(lastValue(wrapper)).toBe(0);
    await area.trigger('keydown', { key: 'ArrowLeft' });
    expect(lastValue(wrapper)).toBe(0);
    await area.trigger('keydown', { key: 'End' });
    expect(lastValue(wrapper)).toBe(100);
    await area.trigger('keydown', { key: 'ArrowRight', shiftKey: true });
    expect(lastValue(wrapper)).toBe(100);
  });

  it('leaves other keys alone', async () => {
    const wrapper = mountDivider();
    await wrapper.get('[data-testid="wipe"]').trigger('keydown', { key: 'a' });
    expect(lastValue(wrapper)).toBe(50);
  });
});
