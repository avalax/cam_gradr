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
  it('zeigt Soll, Kamera und korrigiert in drei Spalten mit je einem Feld pro Zeile', () => {
    const wrapper = mount(GrayWedge, { props: { rows } });
    expect(wrapper.text()).toContain('Soll');
    expect(wrapper.text()).toContain('Kamera');
    expect(wrapper.text()).toContain('korr.');
    for (const key of ['target', 'camera', 'corrected']) {
      expect(wrapper.findAll(`[data-column="${key}"] [data-patch]`)).toHaveLength(2);
    }
    const first = wrapper.get('[data-column="camera"] [data-patch="1E"]');
    expect(first.attributes('style')).toContain('rgb(163, 162, 159)');
  });

  it('lässt das Soll eines einzelnen Felds leer, wenn nur dafür kein Referenzwert vorliegt', () => {
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

  it('lässt die Sollspalte weg, wenn es keine Sollfarben gibt', () => {
    const wrapper = mount(GrayWedge, {
      props: { rows: rows.map((row) => ({ ...row, target: null })) },
    });
    expect(wrapper.find('[data-column="target"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('Soll');
    expect(wrapper.findAll('[data-column]')).toHaveLength(2);
  });
});
