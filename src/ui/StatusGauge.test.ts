import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import StatusGauge from './StatusGauge.vue';

function classes(level: 'off' | 'warn' | 'ok', fill: number) {
  const wrapper = mount(StatusGauge, { props: { level, fill } });
  return wrapper.findAll('i').map((bar) => bar.classes());
}

describe('StatusGauge', () => {
  it('füllt so viele von vier Strichen, wie die Füllung angibt', () => {
    const bars = classes('ok', 3);
    expect(bars).toHaveLength(4);
    expect(bars.map((list) => list.includes('bg-[#4f8f5b]'))).toEqual([true, true, true, false]);
    expect(bars[3]).toContain('bg-zinc-200');
  });

  it('färbt grün bei gut und gelb bei einem Hinweis', () => {
    expect(classes('ok', 1)[0]).toContain('bg-[#4f8f5b]');
    expect(classes('warn', 1)[0]).toContain('bg-[#b8892f]');
  });

  it('bleibt ohne Füllung ganz leer und ist für Screenreader verborgen', () => {
    const wrapper = mount(StatusGauge, { props: { level: 'off', fill: 0 } });
    expect(wrapper.findAll('[data-filled="true"]')).toHaveLength(0);
    expect(wrapper.get('[data-testid="status-gauge"]').attributes('aria-hidden')).toBe('true');
  });
});
