// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import { colorLayout } from '../chart/layouts';
import type { Rgb } from '../chart/types';
import type { FitResult } from '../solve/fit';
import { IDENTITY_MODEL } from '../test-support/identity-model';

import ColorWipe from './ColorWipe.vue';

const report = { meanBefore: 18.44, meanAfter: 8.04 } as FitResult['report'];

function mountWipe(overrides: Record<string, unknown> = {}) {
  return mount(ColorWipe, {
    props: {
      layout: colorLayout,
      measurements: {},
      model: null,
      reference: null,
      report: null,
      live: false,
      ...overrides,
    },
  });
}

describe('ColorWipe', () => {
  it('shows all 48 patches in two layers with default values without a measurement', () => {
    const wrapper = mountWipe();
    const camera = wrapper.get('[data-testid="color-wipe-camera"]');
    expect(camera.attributes('data-measured')).toBe('false');
    expect(camera.findAll('[data-patch]')).toHaveLength(48);
    expect(
      wrapper.get('[data-testid="color-wipe-corrected"]').findAll('[data-patch]'),
    ).toHaveLength(48);
    // Empty until the result comes there (a non-breaking space keeps the height of the line).
    expect(wrapper.get('[data-testid="color-wipe-summary"]').element.textContent).toBe('\u{A0}');
    expect(camera.find('[data-patch="1A"]').attributes('title')).toBe('1A (Standardwert)');
  });

  it('shows the result as a popup on the label once there is a report', () => {
    const wrapper = mount(ColorWipe, {
      props: {
        layout: colorLayout,
        measurements: {},
        model: null,
        reference: null,
        report,
        live: false,
      },
      slots: { details: '<p data-testid="inhalt">Ergebnis</p>' },
    });
    const trigger = wrapper.get('[data-testid="color-wipe-result"]');
    expect(trigger.attributes('tabindex')).toBe('0');
    const popup = wrapper.get('[data-testid="color-wipe-popup"]');
    expect(popup.attributes('role')).toBe('tooltip');
    // Hidden until hover or keyboard focus; within the height of the column, never above it.
    expect(popup.classes()).toEqual(
      expect.arrayContaining([
        'hidden',
        'group-hover:flex',
        'group-focus-within:flex',
        'max-h-full',
      ]),
    );
    expect(popup.get('[data-testid="inhalt"]').text()).toBe('Ergebnis');
  });

  it('closes the result with Escape until the pointer or the focus leaves', async () => {
    const wrapper = mount(ColorWipe, {
      props: {
        layout: colorLayout,
        measurements: {},
        model: null,
        reference: null,
        report,
        live: false,
      },
      slots: { details: '<p>Ergebnis</p>' },
    });
    const trigger = wrapper.get('[data-testid="color-wipe-result"]');
    const popup = () => wrapper.find('[data-testid="color-wipe-popup"]');
    await trigger.trigger('keydown', { key: 'Enter' });
    expect(popup().exists()).toBe(true);
    await trigger.trigger('keydown', { key: 'Escape' });
    expect(popup().exists()).toBe(false);
    await trigger.trigger('mouseleave');
    expect(popup().exists()).toBe(true);
    await trigger.trigger('keydown', { key: 'Escape' });
    await trigger.trigger('focusout');
    expect(popup().exists()).toBe(true);
    // A click does not focus the trigger, so the result closes when the pointer leaves.
    const mousedown = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    trigger.element.dispatchEvent(mousedown);
    expect(mousedown.defaultPrevented).toBe(true);
  });

  it('hands the focus to the trigger when Escape closes the result from inside', async () => {
    const wrapper = mount(ColorWipe, {
      props: {
        layout: colorLayout,
        measurements: {},
        model: null,
        reference: null,
        report,
        live: false,
      },
      slots: { details: '<button type="button" data-testid="inside">Ergebnis</button>' },
      attachTo: document.body,
    });
    const inside = wrapper.get('[data-testid="inside"]');
    (inside.element as HTMLButtonElement).focus();
    await inside.trigger('keydown', { key: 'Escape' });
    expect(wrapper.find('[data-testid="color-wipe-popup"]').exists()).toBe(false);
    expect(document.activeElement).toBe(wrapper.get('[data-testid="color-wipe-result"]').element);
    wrapper.unmount();
  });

  it('has no popup and is not focusable without a report', () => {
    const withoutReport = mount(ColorWipe, {
      props: {
        layout: colorLayout,
        measurements: {},
        model: null,
        reference: null,
        report: null,
        live: false,
      },
      slots: { details: '<p>Ergebnis</p>' },
    });
    expect(withoutReport.find('[data-testid="color-wipe-popup"]').exists()).toBe(false);
    expect(
      withoutReport.get('[data-testid="color-wipe-result"]').attributes('tabindex'),
    ).toBeUndefined();
  });

  it('orders the patches as on the cards, row by row from A to H per card', () => {
    const wrapper = mountWipe();
    const ids = wrapper
      .get('[data-testid="color-wipe-camera"]')
      .findAll('[data-patch]')
      .map((tile) => tile.attributes('data-patch'));
    expect(ids.slice(0, 8)).toEqual(['1A', '1B', '1C', '1D', '2A', '2B', '2C', '2D']);
    expect(ids.slice(24, 28)).toEqual(['1E', '1F', '1G', '1H']);
    expect(ids.at(-1)).toBe('6H');
  });

  it('shows measured patches in full and names the deviation before and after', () => {
    const measurements: Record<string, Rgb> = { '1A': [0.2, 0.3, 0.4] };
    const wrapper = mountWipe({ measurements, report });
    const tile = wrapper.get('[data-testid="color-wipe-camera"] [data-patch="1A"]');
    expect(tile.attributes('title')).toBe('1A');
    expect(tile.classes()).not.toContain('opacity-50');
    expect(tile.attributes('style')).toContain('rgb(51, 77, 102)');
    expect(wrapper.get('[data-testid="color-wipe-camera"]').attributes('data-measured')).toBe(
      'true',
    );
    expect(wrapper.get('[data-testid="color-wipe-summary"]').text()).toBe(
      'Ø Abweichung 18,4 → 8,0',
    );
  });

  it('says that a correction loaded without its reference set has no report', () => {
    const wrapper = mountWipe({ model: IDENTITY_MODEL });
    expect(wrapper.get('[data-testid="color-wipe-summary"]').text()).toBe(
      'Ohne Bericht (Referenz fehlt)',
    );
    expect(wrapper.get('[data-testid="color-wipe-result"]').attributes('tabindex')).toBeUndefined();
  });

  it('fades in the corrected layer right of the line and follows the wipe', async () => {
    const wrapper = mountWipe();
    const corrected = wrapper.get('[data-testid="color-wipe-corrected"]');
    expect(corrected.attributes('style')).toContain('inset(0 0 0 50%)');
    expect(wrapper.get('[data-testid="color-wipe-camera"]').attributes('style')).toBeUndefined();
    await wrapper.get('[data-testid="wipe"]').trigger('keydown', { key: 'Home' });
    expect(corrected.attributes('style')).toContain('inset(0 0 0 0%)');
  });
});

describe('ColorWipe with the live image', () => {
  it('shows only the camera layer without a divider and, like the tab, that nothing is computed', () => {
    const wrapper = mountWipe({ live: true });
    expect(wrapper.find('[data-testid="color-wipe-camera"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="color-wipe-corrected"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="wipe"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('Noch nicht berechnet');
  });

  it('says that the comparison follows the capture while a correction from before exists', () => {
    const wrapper = mountWipe({ live: true, model: IDENTITY_MODEL });
    expect(wrapper.text()).toContain('Vergleich nach der Aufnahme');
  });

  it('shows both layers and the divider otherwise', () => {
    const wrapper = mountWipe({ live: false });
    expect(wrapper.find('[data-testid="color-wipe-corrected"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="wipe"]').exists()).toBe(true);
  });
});
