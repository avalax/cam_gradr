import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import { setLocale } from '../lang';

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
  it('shows a grid per card and three strips per patch: target, camera, corrected', () => {
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

  it('omits the target strip when there are no target colors', () => {
    const wrapper = mount(ColorTiles, {
      props: { cards: [[{ ...first, target: null }]] },
    });
    const stripes = wrapper
      .findAll('[data-stripe]')
      .map((stripe) => stripe.attributes('data-stripe'));
    expect(stripes).toEqual(['camera', 'corrected']);
  });

  it('leaves the target of a single patch empty when only that one has no reference value', () => {
    const wrapper = mount(ColorTiles, {
      props: { cards: [[first, { ...second, target: null }]] },
    });
    expect(
      wrapper.get('[data-patch="1F"] [data-stripe="target"]').attributes('style'),
    ).toBeUndefined();
  });
});

describe('ColorTiles (English)', () => {
  it('labels the grid in English', () => {
    setLocale('en');
    const wrapper = mount(ColorTiles, { props: { cards: [[first]] } });
    expect(wrapper.get('[data-testid="color-tiles"]').attributes('aria-label')).toBe(
      'Color patches: target, camera and after correction',
    );
  });
});
