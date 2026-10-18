import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import type { ExposureResult } from '../chart/exposure';

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
  it('zeigt ohne Messung ein leeres Feld ohne Punkt', () => {
    const wrapper = mount(MeasureField, { props: { exposure: null } });
    expect(wrapper.find('[data-testid="measure-marker"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="measure-field"]').attributes('aria-label')).toBe(
      'Helligkeit und Kontrast: Noch keine Messung.',
    );
    expect(wrapper.get('[data-testid="measure-details"]').text()).toBe('Noch keine Messung.');
  });

  it('zeigt im Normalbereich und ohne Messung keine Meldung am Rand', () => {
    expect(
      mount(MeasureField, { props: { exposure: null } })
        .find('[data-testid="measure-issue"]')
        .exists(),
    ).toBe(false);
    const fine = {
      ...exposure,
      highlightsClipped: false,
      shadowsCrushed: false,
      delta: 0,
      contrast: 0,
    };
    expect(
      mount(MeasureField, { props: { exposure: fine } })
        .find('[data-testid="measure-issue"]')
        .exists(),
    ).toBe(false);
  });

  it('setzt den Punkt nach Helligkeit (senkrecht) und Kontrast (waagerecht)', () => {
    const wrapper = mount(MeasureField, { props: { exposure } });
    const style = wrapper.get('[data-testid="measure-marker"]').attributes('style');
    expect(style).toContain('left: 25%');
    expect(style).toContain('top: 25%');
  });

  it('zeigt Hinweis und Details im Tooltip', () => {
    const wrapper = mount(MeasureField, { props: { exposure } });
    const details = wrapper.get('[data-testid="measure-details"]');
    expect(details.attributes('role')).toBe('tooltip');
    expect(details.text()).toContain('Kontrast');
    expect(details.text()).toContain('60 % (Soll 46 %)');
    expect(details.text()).toContain('0 % schwarz, 100 % weiß');
    expect(details.text()).toContain('überbelichtet');
    expect(wrapper.get('[data-testid="measure-hint"]').text()).toBe(
      'Lichter überbelichtet: Helligkeit verringern (Beleuchtung abschwächen oder Belichtung der Kamera verringern). Danach den Kontrast prüfen.',
    );
  });

  it('legt die wichtigste Meldung an den Rand, zu dem die Messung abweicht', () => {
    const bright = mount(MeasureField, { props: { exposure } }).get(
      '[data-testid="measure-issue"]',
    );
    expect(bright.text()).toBe('Helligkeit zu hoch');
    expect(bright.attributes('data-edge')).toBe('top');
    const dark = mount(MeasureField, {
      props: { exposure: { ...exposure, highlightsClipped: false, shadowsCrushed: true } },
    }).get('[data-testid="measure-issue"]');
    expect(dark.text()).toBe('Helligkeit zu niedrig');
    expect(dark.attributes('data-edge')).toBe('bottom');
    const flat = mount(MeasureField, {
      props: { exposure: { ...exposure, highlightsClipped: false, delta: 0, contrast: -0.1 } },
    }).get('[data-testid="measure-issue"]');
    expect(flat.text()).toBe('Kontrast zu niedrig');
    expect(flat.attributes('data-edge')).toBe('left');
    const harsh = mount(MeasureField, {
      props: { exposure: { ...exposure, highlightsClipped: false, delta: 0, contrast: 0.1 } },
    }).get('[data-testid="measure-issue"]');
    expect(harsh.text()).toBe('Kontrast zu hoch');
    expect(harsh.attributes('data-edge')).toBe('right');
  });

  it('zeigt den Normalbereich in der Mitte des Felds', () => {
    const wrapper = mount(MeasureField, { props: { exposure } });
    const style = wrapper.get('[data-testid="measure-ok-box"]').attributes('style');
    expect(style).toContain('left: 40%');
    expect(style).toContain('top: 40%');
    expect(style).toContain('width: 20%');
    expect(style).toContain('height: 20%');
  });

  it('ist per Tastatur fokussierbar', () => {
    const wrapper = mount(MeasureField, { props: { exposure: null } });
    expect(wrapper.get('[data-testid="measure-field"]').attributes('tabindex')).toBe('0');
  });
});
