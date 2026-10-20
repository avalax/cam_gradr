import { describe, expect, it } from 'vitest';

import colorJson from '../data/layouts/spyder-checkr-photo-color.layout.json';
import grayJson from '../data/layouts/spyder-checkr-photo-gray.layout.json';

import { parseLayout } from './layout';

const rect = { x: 0.1, y: 0.1, w: 0.2, h: 0.2 };

function layoutWith(patch: unknown) {
  return { format: 'cam_gradr-layout/2', cards: [{ card: 1, patches: [patch] }] };
}

describe('parseLayout with the bundled files', () => {
  it('reads the color layout: 2 charts with 24 patches each', () => {
    const layout = parseLayout(colorJson);
    expect(layout.cards.map((card) => card.patches.length)).toEqual([24, 24]);
  });

  it('marks the twelve neutral patches of the color charts (columns D and E)', () => {
    const layout = parseLayout(colorJson);
    const neutral = layout.cards.flatMap((card) =>
      card.patches.filter((patch) => patch.role === 'neutral').map((patch) => patch.id),
    );
    expect(neutral.toSorted((a, b) => a.localeCompare(b))).toEqual(
      ['1D', '2D', '3D', '4D', '5D', '6D', '1E', '2E', '3E', '4E', '5E', '6E'].toSorted((a, b) =>
        a.localeCompare(b),
      ),
    );
  });

  it('reads the gray layout: 2 charts with one large patch and 6 strip patches each', () => {
    const layout = parseLayout(grayJson);
    expect(layout.cards.map((card) => card.card)).toEqual([3, 4]);
    for (const card of layout.cards) {
      expect(card.patches.filter((patch) => patch.role === 'large')).toHaveLength(1);
      expect(card.patches.filter((patch) => patch.role === 'strip')).toHaveLength(6);
    }
  });
});

describe('nominal values of the patches', () => {
  it('reads nominalLab of the large gray patches', () => {
    const layout = parseLayout(grayJson);
    const nominal = Object.fromEntries(
      layout.cards.flatMap((card) => card.patches.map((patch) => [patch.id, patch.nominalLab])),
    );
    expect(nominal.G50).toEqual([76.07, 0, 0]);
    expect(nominal.G18).toEqual([49.5, 0, 0]);
    expect(nominal['S3-0']).toBeUndefined();
  });

  it('rejects a nominalLab without three numbers', () => {
    expect(() => parseLayout(layoutWith({ id: 'a', rect, nominalLab: [1, 2] }))).toThrow(
      'nominalLab',
    );
    expect(() => parseLayout(layoutWith({ id: 'a', rect, nominalLab: [1, 2, 'x'] }))).toThrow(
      'nominalLab',
    );
  });
});

describe('parseLayout error cases', () => {
  it('rejects a wrong format', () => {
    expect(() => parseLayout(null)).toThrow('Invalid layout format');
    expect(() => parseLayout({ format: 'x', cards: [] })).toThrow('Invalid layout format');
    expect(() => parseLayout({ format: 'cam_gradr-layout/2' })).toThrow('Invalid layout format');
  });

  it('rejects invalid charts', () => {
    expect(() => parseLayout({ format: 'cam_gradr-layout/2', cards: [1] })).toThrow('Invalid card');
    expect(() =>
      parseLayout({ format: 'cam_gradr-layout/2', cards: [{ card: 'a', patches: [] }] }),
    ).toThrow('Invalid card');
    expect(() =>
      parseLayout({ format: 'cam_gradr-layout/2', cards: [{ card: 1, patches: 5 }] }),
    ).toThrow('Invalid card');
  });

  it('rejects patches without an ID', () => {
    expect(() => parseLayout(layoutWith(null))).toThrow('without a valid id');
    expect(() => parseLayout(layoutWith({ id: 5, rect }))).toThrow('without a valid id');
    expect(() => parseLayout(layoutWith({ id: '', rect }))).toThrow('without a valid id');
  });

  it('rejects missing or invalid rectangles', () => {
    expect(() => parseLayout(layoutWith({ id: 'a' }))).toThrow('rect is missing');
    expect(() => parseLayout(layoutWith({ id: 'a', rect: { ...rect, w: 'x' } }))).toThrow(
      'invalid numbers',
    );
    expect(() => parseLayout(layoutWith({ id: 'a', rect: { ...rect, x: NaN } }))).toThrow(
      'invalid numbers',
    );
  });

  it('rejects rectangles outside the chart', () => {
    for (const bad of [{ w: 0 }, { h: -1 }, { x: -0.1 }, { y: -0.1 }, { x: 0.9 }, { y: 0.9 }]) {
      expect(() => parseLayout(layoutWith({ id: 'a', rect: { ...rect, ...bad } }))).toThrow(
        'not inside the card',
      );
    }
  });

  it('rejects duplicate IDs', () => {
    const doubled = {
      format: 'cam_gradr-layout/2',
      cards: [
        {
          card: 1,
          patches: [
            { id: 'a', rect },
            { id: 'a', rect },
          ],
        },
      ],
    };
    expect(() => parseLayout(doubled)).toThrow('Duplicate patch id');
  });

  it('adopts role only for known values', () => {
    const layout = parseLayout(layoutWith({ id: 'a', rect, role: 'large' }));
    expect(layout.cards[0]?.patches[0]?.role).toBe('large');
    expect(
      parseLayout(layoutWith({ id: 'a', rect, role: 'neutral' })).cards[0]?.patches[0]?.role,
    ).toBe('neutral');
    const other = parseLayout(layoutWith({ id: 'a', rect, role: 'foo' }));
    expect(other.cards[0]?.patches[0]).toEqual({ id: 'a', rect });
  });
});
