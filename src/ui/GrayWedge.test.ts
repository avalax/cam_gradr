// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import type { WedgeRow } from './gray-wedge';
import GrayWedge from './GrayWedge.vue';

const rows: WedgeRow[] = [
  {
    id: '1E',
    target: 'rgb(250, 242, 239)',
    camera: 'rgb(163, 162, 159)',
    corrected: 'rgb(244, 244, 244)',
  },
  { id: '6E', target: 'rgb(43, 41, 43)', camera: 'rgb(6, 6, 9)', corrected: 'rgb(42, 42, 42)' },
];

describe('GrayWedge', () => {
  it('shows target, camera and corrected in three columns with one patch per row', () => {
    const wrapper = mount(GrayWedge, { props: { rows } });
    expect(wrapper.text()).toContain('Soll');
    expect(wrapper.text()).toContain('Kamera');
    expect(wrapper.text()).toContain('Korrigiert');
    for (const key of ['target', 'camera', 'corrected']) {
      expect(wrapper.findAll(`[data-column="${key}"] [data-patch]`)).toHaveLength(2);
    }
    const first = wrapper.get('[data-column="camera"] [data-patch="1E"]');
    expect(first.attributes('style')).toContain('rgb(163, 162, 159)');
  });

  it('leaves the target of a single patch empty when only that one has no reference value', () => {
    const mixed = rows.map((row) => (row.id === '6E' ? { ...row, target: null } : row));
    const wrapper = mount(GrayWedge, { props: { rows: mixed } });
    expect(wrapper.findAll('[data-column="target"] [data-patch]')).toHaveLength(2);
    expect(
      wrapper.get('[data-column="target"] [data-patch="6E"]').attributes('style'),
    ).toBeUndefined();
    expect(wrapper.get('[data-column="target"] [data-patch="1E"]').attributes('style')).toContain(
      'rgb(250, 242, 239)',
    );
  });

  it('omits the target column when there are no target colors', () => {
    const wrapper = mount(GrayWedge, {
      props: { rows: rows.map((row) => ({ ...row, target: null })) },
    });
    expect(wrapper.find('[data-column="target"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('Soll');
    expect(wrapper.get('[data-testid="gray-wedge"]').attributes('aria-label')).toBe(
      'Graustufen der Farbkarten: Kamera und nach der Korrektur',
    );
    expect(wrapper.findAll('[data-column]')).toHaveLength(2);
  });
});
