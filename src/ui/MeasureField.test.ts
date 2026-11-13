// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import type { ExposureResult } from '../chart/exposure';
import { setLocale } from '../lang';

import MeasureField from './MeasureField.vue';

const exposure: ExposureResult = {
  verdict: 'too-bright',
  highlightsClipped: true,
  shadowsCrushed: false,
  level18: 0.6,
  level50: 0.86,
  delta: 0.15,
  contrast: -0.125,
};

describe('MeasureField', () => {
  // Positions and texts are computed and tested in measure-field.ts; here the field shows them.
  it('shows an empty, keyboard focusable field without a dot when there is no measurement', () => {
    const wrapper = mount(MeasureField, { props: { exposure: null } });
    expect(wrapper.find('[data-testid="measure-marker"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="measure-title"]').text()).toBe('Noch nicht gemessen');
    const field = wrapper.get('[data-testid="measure-field"]');
    expect(field.attributes('tabindex')).toBe('0');
    expect(field.attributes('aria-label')).toBe('Helligkeit und Kontrast: Noch keine Messung.');
    expect(wrapper.get('[data-testid="measure-details"]').text()).toBe('Noch keine Messung.');
  });

  it('shows dot, both ranges, the hint on top and details of a measurement', () => {
    const wrapper = mount(MeasureField, { props: { exposure } });
    const marker = wrapper.get('[data-testid="measure-marker"]').attributes('style');
    expect(marker).toContain('left: 25%');
    expect(marker).toContain('top: 25%');
    expect(wrapper.get('[data-testid="measure-ok-box"]').attributes('style')).toContain(
      'left: 40%',
    );
    expect(wrapper.get('[data-testid="measure-slight-box"]').attributes('style')).toContain(
      'left: 30%',
    );
    expect(wrapper.get('[data-testid="measure-title"]').text()).toBe('Helligkeit zu hoch');
    const details = wrapper.get('[data-testid="measure-details"]');
    expect(details.attributes('role')).toBe('tooltip');
    expect(details.text()).toContain('60 % (Soll 46 %)');
    expect(wrapper.get('[data-testid="measure-hint"]').text()).toBe(
      'Licht abschwächen oder Belichtung der Kamera verringern.',
    );
  });

  it('opens the details on hover and keyboard focus, not on a click, and closes them with Escape', async () => {
    const wrapper = mount(MeasureField, { props: { exposure } });
    const field = wrapper.get('[data-testid="measure-field"]');
    const details = () => wrapper.find('[data-testid="measure-details"]');
    expect(details().classes()).toEqual(
      expect.arrayContaining(['hidden', 'group-hover:block', 'group-focus-visible:block']),
    );
    await field.trigger('keydown', { key: 'Escape' });
    expect(details().exists()).toBe(false);
    await field.trigger('focusout');
    expect(details().exists()).toBe(true);
    await field.trigger('keydown', { key: 'Escape' });
    await field.trigger('mouseleave');
    expect(details().exists()).toBe(true);
  });

  it('shows English texts and follows a language switch', async () => {
    setLocale('en');
    const wrapper = mount(MeasureField, { props: { exposure } });
    expect(wrapper.get('[data-testid="measure-title"]').text()).toBe('Brightness too high');
    expect(wrapper.get('[data-testid="measure-details"]').text()).toContain(
      'Brightness of the gray patches in the image',
    );
    expect(wrapper.get('[data-testid="measure-field"]').attributes('aria-label')).toMatch(
      /^Brightness and contrast: /,
    );
    setLocale('de');
    await wrapper.vm.$nextTick();
    expect(wrapper.get('[data-testid="measure-title"]').text()).toBe('Helligkeit zu hoch');
  });
});
