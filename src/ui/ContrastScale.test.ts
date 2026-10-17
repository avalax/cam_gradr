import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import type { ExposureResult } from '../chart/exposure';

import ContrastScale from './ContrastScale.vue';

const exposure: ExposureResult = {
  verdict: 'ok',
  highlightsClipped: false,
  shadowsCrushed: false,
  level18: 0.5,
  level50: 0.7,
  delta: 0,
  contrast: -0.08,
};

describe('ContrastScale', () => {
  it('zeigt ohne Messung eine abgeblendete Skala ohne Marke', () => {
    const wrapper = mount(ContrastScale, { props: { exposure: null } });
    expect(wrapper.find('[data-testid="contrast-marker"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="contrast-scale"]').attributes('aria-label')).toBe(
      'Kontrast: Noch keine Messung.',
    );
    expect(wrapper.get('[data-testid="contrast-details"]').text()).toBe('Noch keine Messung.');
  });

  it('setzt die Marke nach der Abweichung und nennt Hinweis und Details im Tooltip', () => {
    const wrapper = mount(ContrastScale, { props: { exposure } });
    expect(wrapper.get('[data-testid="contrast-marker"]').attributes('style')).toContain(
      'top: 70%',
    );
    const details = wrapper.get('[data-testid="contrast-details"]');
    expect(details.attributes('role')).toBe('tooltip');
    expect(details.text()).toContain('zu niedrig');
    expect(details.text()).toContain('Abstand');
    expect(details.text()).toContain('−8 Punkte');
    expect(wrapper.get('[data-testid="contrast-scale"]').attributes('aria-label')).toContain(
      'zu niedrig',
    );
  });

  it('zeigt den Zielbereich, wenn eine Messung da ist und ohne', () => {
    expect(
      mount(ContrastScale, { props: { exposure } })
        .get('[data-testid="contrast-ok-band"]')
        .classes(),
    ).not.toContain('opacity-40');
    expect(
      mount(ContrastScale, { props: { exposure: null } })
        .get('[data-testid="contrast-ok-band"]')
        .classes(),
    ).toContain('opacity-40');
  });
});
