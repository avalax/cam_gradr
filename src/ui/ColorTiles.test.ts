import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import type { WedgeRow } from './gray-wedge';
import ColorTiles from './ColorTiles.vue';

const first: WedgeRow = {
  id: '1A',
  target: 'rgb(115, 82, 68)',
  camera: 'rgb(90, 60, 60)',
  corrected: 'rgb(112, 80, 66)',
};
const second: WedgeRow = { ...first, id: '1F' };

describe('ColorTiles', () => {
  it('zeigt je Karte ein Raster und je Feld drei Streifen: Soll, Kamera, korrigiert', () => {
    const wrapper = mount(ColorTiles, { props: { cards: [[first], [second]] } });
    expect(wrapper.findAll('[data-patch]').map((tile) => tile.attributes('data-patch'))).toEqual([
      '1A',
      '1F',
    ]);
    const stripes = wrapper
      .get('[data-patch="1A"]')
      .findAll('[data-stripe]')
      .map((stripe) => stripe.attributes('data-stripe'));
    expect(stripes).toEqual(['target', 'camera', 'corrected']);
    expect(wrapper.get('[data-patch="1A"] [data-stripe="camera"]').attributes('style')).toContain(
      'rgb(90, 60, 60)',
    );
  });

  it('lässt den Streifen für das Soll weg, wenn es keine Sollfarben gibt', () => {
    const wrapper = mount(ColorTiles, {
      props: { cards: [[{ ...first, target: null }]] },
    });
    const stripes = wrapper
      .findAll('[data-stripe]')
      .map((stripe) => stripe.attributes('data-stripe'));
    expect(stripes).toEqual(['camera', 'corrected']);
  });

  it('lässt das Soll eines einzelnen Felds leer, wenn nur dafür kein Referenzwert vorliegt', () => {
    const wrapper = mount(ColorTiles, {
      props: { cards: [[first, { ...second, target: null }]] },
    });
    expect(
      wrapper.get('[data-patch="1F"] [data-stripe="target"]').attributes('style'),
    ).toBeUndefined();
  });
});
