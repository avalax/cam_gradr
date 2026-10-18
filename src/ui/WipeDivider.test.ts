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
  it('zeigt Strich und Griff an der aktuellen Lage und beschreibt sich als Schieberegler', () => {
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

  it('setzt den Strich beim Klicken und Ziehen auf die Zeigerposition', async () => {
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

  it('folgt dem Zeiger nur, solange er gedrückt ist', async () => {
    const wrapper = mountDivider();
    const element = wrapper.get('[data-testid="wipe"]').element as HTMLElement;
    element.hasPointerCapture = vi.fn(() => false);
    await wrapper
      .get('[data-testid="wipe"]')
      .trigger('pointermove', { clientX: 250, pointerId: 1 });
    expect(lastValue(wrapper)).toBe(50);
  });

  it('ignoriert Zeigerbewegungen, solange die Fläche keine Breite hat', async () => {
    const wrapper = mountDivider();
    const element = wrapper.get('[data-testid="wipe"]').element as HTMLElement;
    element.getBoundingClientRect = () => ({ left: 0, width: 0 }) as DOMRect;
    await wrapper.get('[data-testid="wipe"]').trigger('pointerdown', { clientX: 10, pointerId: 1 });
    expect(lastValue(wrapper)).toBe(50);
  });

  it('wird mit den Pfeiltasten verschoben, mit Umschalt in größeren Schritten', async () => {
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

  it('springt mit Pos1 und Ende an den Rand und bleibt auf der Fläche', async () => {
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

  it('lässt andere Tasten unberührt', async () => {
    const wrapper = mountDivider();
    await wrapper.get('[data-testid="wipe"]').trigger('keydown', { key: 'a' });
    expect(lastValue(wrapper)).toBe(50);
  });
});
