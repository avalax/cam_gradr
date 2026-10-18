import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

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
  it('zeigt ohne Messung alle 48 Felder in zwei Ebenen mit Standardwerten', () => {
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

  it('ordnet die Felder wie auf den Karten, Zeile für Zeile von A nach H je Karte', () => {
    const wrapper = mountWipe();
    const ids = wrapper
      .get('[data-testid="color-wipe-camera"]')
      .findAll('[data-patch]')
      .map((tile) => tile.attributes('data-patch'));
    expect(ids.slice(0, 8)).toEqual(['1A', '1B', '1C', '1D', '2A', '2B', '2C', '2D']);
    expect(ids.slice(24, 28)).toEqual(['1E', '1F', '1G', '1H']);
    expect(ids.at(-1)).toBe('6H');
  });

  it('zeigt gemessene Felder voll und nennt die Abweichung vorher und nachher', () => {
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

  it('sieht ohne Korrektur auf beiden Seiten des Strichs gleich aus', () => {
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
    // Ohne Messung zeigt ein Feld ungeschwächt die Sollfarbe der Referenz.
    const target = wrapper.get('[data-testid="color-wipe-camera"] [data-patch="2A"]');
    expect(target.attributes('style')).toContain(cssColor(labToSrgb([50, 20, -10])));
  });

  it('blendet die korrigierte Ebene rechts vom Strich ein und folgt dem Wischer', async () => {
    const wrapper = mountWipe();
    const corrected = wrapper.get('[data-testid="color-wipe-corrected"]');
    expect(corrected.attributes('style')).toContain('inset(0 0 0 50%)');
    expect(wrapper.get('[data-testid="color-wipe-camera"]').attributes('style')).toBeUndefined();
    await wrapper.get('[data-testid="wipe"]').trigger('keydown', { key: 'Home' });
    expect(corrected.attributes('style')).toContain('inset(0 0 0 0%)');
  });
});
