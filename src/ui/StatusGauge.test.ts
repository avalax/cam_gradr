import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import StatusGauge from './StatusGauge.vue';

function classes(level: 'off' | 'warn' | 'ok', fill: number) {
  const wrapper = mount(StatusGauge, { props: { level, fill } });
  return wrapper.findAll('i').map((bar) => bar.classes());
}

describe('StatusGauge', () => {
  it('fills as many of four bars as the fill level indicates', () => {
    const bars = classes('ok', 3);
    expect(bars).toHaveLength(4);
    expect(bars.map((list) => list.includes('bg-[#4f8f5b]'))).toEqual([true, true, true, false]);
    expect(bars[3]).toContain('bg-zinc-200');
  });

  it('colors green for good and yellow for a hint', () => {
    expect(classes('ok', 1)[0]).toContain('bg-[#4f8f5b]');
    expect(classes('warn', 1)[0]).toContain('bg-[#b8892f]');
  });

  it('stays completely empty without a fill and is hidden from screen readers', () => {
    const wrapper = mount(StatusGauge, { props: { level: 'off', fill: 0 } });
    expect(wrapper.findAll('[data-filled="true"]')).toHaveLength(0);
    expect(wrapper.get('[data-testid="status-gauge"]').attributes('aria-hidden')).toBe('true');
  });
});
