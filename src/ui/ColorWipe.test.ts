import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import { setLocale } from '../lang';
import { colorLayout } from '../chart/layouts';
import { labToSrgb } from '../color/lab';
import type { Rgb } from '../chart/types';
import type { FitResult } from '../solve/fit';

import { cssColor } from './color-css';
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
    expect(wrapper.get('[data-testid="color-wipe-summary"]').text()).toBe('Noch keine Korrektur');
    expect(camera.find('[data-patch="1A"]').attributes('title')).toBe('1A (Standardwert)');
  });

  it('shows the result as a popup on the label once there is a report', () => {
    const wrapper = mount(ColorWipe, {
      props: { layout: colorLayout, measurements: {}, model: null, reference: null, report },
      slots: { details: '<p data-testid="inhalt">Ergebnis</p>' },
    });
    const trigger = wrapper.get('[data-testid="color-wipe-result"]');
    expect(trigger.attributes('tabindex')).toBe('0');
    const popup = wrapper.get('[data-testid="color-wipe-popup"]');
    expect(popup.attributes('role')).toBe('tooltip');
    expect(popup.classes()).toContain('hidden');
    expect(popup.classes()).toContain('group-hover:block');
    expect(popup.get('[data-testid="inhalt"]').text()).toBe('Ergebnis');
  });

  it('has no popup and is not focusable without a report or without content', () => {
    const withoutReport = mount(ColorWipe, {
      props: { layout: colorLayout, measurements: {}, model: null, reference: null, report: null },
      slots: { details: '<p>Ergebnis</p>' },
    });
    expect(withoutReport.find('[data-testid="color-wipe-popup"]').exists()).toBe(false);
    expect(
      withoutReport.get('[data-testid="color-wipe-result"]').attributes('tabindex'),
    ).toBeUndefined();
    const withoutSlot = mountWipe({ report });
    expect(withoutSlot.find('[data-testid="color-wipe-popup"]').exists()).toBe(false);
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

  it('looks the same on both sides of the line without a correction', () => {
    const measurements: Record<string, Rgb> = { '1A': [0.2, 0.3, 0.4] };
    const wrapper = mountWipe({
      measurements,
      reference: { name: 'Test', patches: { '2A': [50, 20, -10] } },
    });
    for (const id of ['1A', '2A', '3A']) {
      const camera = wrapper.get(`[data-testid="color-wipe-camera"] [data-patch="${id}"]`);
      const corrected = wrapper.get(`[data-testid="color-wipe-corrected"] [data-patch="${id}"]`);
      expect(corrected.attributes('style')).toBe(camera.attributes('style'));
      expect(corrected.classes()).toEqual(camera.classes());
      expect(corrected.classes()).not.toContain('opacity-50');
      expect(corrected.element.parentElement?.parentElement?.className).toContain('bg-zinc-50');
      expect(corrected.attributes('title')).toBe(camera.attributes('title'));
    }
    expect(wrapper.get('[data-testid="color-wipe-corrected"]').attributes('data-measured')).toBe(
      'false',
    );
    // Without a measurement a patch shows the reference target color undiluted.
    const target = wrapper.get('[data-testid="color-wipe-camera"] [data-patch="2A"]');
    expect(target.attributes('style')).toContain(cssColor(labToSrgb([50, 20, -10])));
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

describe('ColorWipe (English)', () => {
  it('shows label, layers and summary in English', () => {
    setLocale('en');
    const wrapper = mountWipe();
    expect(wrapper.text()).toContain('left camera · right corrected');
    expect(wrapper.get('[data-testid="color-wipe-camera"]').attributes('aria-label')).toBe(
      'Camera colors',
    );
    expect(wrapper.get('[data-testid="color-wipe-corrected"]').attributes('aria-label')).toBe(
      'Colors after correction',
    );
    expect(wrapper.get('[data-testid="color-wipe-summary"]').text()).toBe('No correction yet');
    expect(
      wrapper.get('[data-testid="color-wipe-camera"] [data-patch="1A"]').attributes('title'),
    ).toBe('1A (default value)');
    const withReport = mountWipe({ report });
    expect(withReport.get('[data-testid="color-wipe-summary"]').text()).toBe(
      'Ø deviation 18.4 → 8.0',
    );
  });
});

describe('ColorWipe with the live image', () => {
  it('shows only the camera layer without a divider and says when the comparison comes', () => {
    const wrapper = mountWipe({ live: true });
    expect(wrapper.find('[data-testid="color-wipe-camera"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="color-wipe-corrected"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="wipe"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('Vergleich nach der Aufnahme');
  });

  it('shows both layers and the divider otherwise', () => {
    const wrapper = mountWipe({ live: false });
    expect(wrapper.find('[data-testid="color-wipe-corrected"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="wipe"]').exists()).toBe(true);
  });
});
