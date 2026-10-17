import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import type { ExposureResult } from '../chart/exposure';

import BrightnessScale from './BrightnessScale.vue';

const exposure: ExposureResult = {
  verdict: 'too-bright',
  highlightsClipped: true,
  shadowsCrushed: false,
  level18: 0.6,
  level50: 0.86,
  delta: 0.13,
  contrast: 0.02,
};

describe('BrightnessScale', () => {
  it('zeigt ohne Messung eine graue Skala ohne Marke', () => {
    const wrapper = mount(BrightnessScale, { props: { exposure: null } });
    expect(wrapper.find('[data-testid="scale-marker"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="brightness-scale"]').attributes('aria-label')).toBe(
      'Raumhelligkeit: Noch keine Messung.',
    );
    expect(wrapper.get('[data-testid="scale-details"]').text()).toBe('Noch keine Messung.');
    expect(wrapper.find('[data-testid="scale-clipped-top"]').exists()).toBe(false);
  });

  it('setzt die Marke nach der Abweichung und zeigt Details im Tooltip', () => {
    const wrapper = mount(BrightnessScale, { props: { exposure } });
    const marker = wrapper.get('[data-testid="scale-marker"]');
    expect(marker.attributes('style')).toContain('top: 28.3');
    const details = wrapper.get('[data-testid="scale-details"]');
    expect(details.attributes('role')).toBe('tooltip');
    expect(details.text()).toContain('zu hell');
    expect(details.text()).toContain('60 %');
    expect(details.text()).toContain('geclippt');
    expect(wrapper.get('[data-testid="brightness-scale"]').attributes('aria-label')).toContain(
      'zu hell',
    );
  });

  it('markiert geclippte Lichter oben und abgesoffene Schatten unten', () => {
    const wrapper = mount(BrightnessScale, { props: { exposure } });
    expect(wrapper.find('[data-testid="scale-clipped-top"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="scale-crushed-bottom"]').exists()).toBe(false);
    const both = mount(BrightnessScale, {
      props: { exposure: { ...exposure, highlightsClipped: false, shadowsCrushed: true } },
    });
    expect(both.find('[data-testid="scale-clipped-top"]').exists()).toBe(false);
    expect(both.find('[data-testid="scale-crushed-bottom"]').exists()).toBe(true);
  });

  it('zeigt den Zielbereich in der Mitte der Skala', () => {
    const wrapper = mount(BrightnessScale, { props: { exposure } });
    const band = wrapper.get('[data-testid="scale-ok-band"]');
    expect(band.attributes('style')).toContain('top: 40%');
    expect(band.attributes('style')).toContain('height: 20%');
  });

  it('ist per Tastatur fokussierbar', () => {
    const wrapper = mount(BrightnessScale, { props: { exposure: null } });
    expect(wrapper.get('[data-testid="brightness-scale"]').attributes('tabindex')).toBe('0');
  });
});
