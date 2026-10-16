import { describe, expect, it } from 'vitest';

import colorJson from '../data/layouts/spyder-checkr-photo-color.layout.json';
import grayJson from '../data/layouts/spyder-checkr-photo-gray.layout.json';

import { parseLayout } from './layout';

const rect = { x: 0.1, y: 0.1, w: 0.2, h: 0.2 };

function layoutWith(patch: unknown) {
  return { format: 'cam_gradr-layout/2', cards: [{ card: 1, patches: [patch] }] };
}

describe('parseLayout mit den mitgelieferten Dateien', () => {
  it('liest das Farblayout: 2 Karten mit je 24 Feldern', () => {
    const layout = parseLayout(colorJson);
    expect(layout.cards.map((card) => card.patches.length)).toEqual([24, 24]);
  });

  it('markiert die zwölf Neutralfelder der Farbkarten (Spalte D und E)', () => {
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

  it('liest das Graulayout: 2 Karten mit je einem großen Feld und 6 Streifenfeldern', () => {
    const layout = parseLayout(grayJson);
    expect(layout.cards.map((card) => card.card)).toEqual([3, 4]);
    for (const card of layout.cards) {
      expect(card.patches.filter((patch) => patch.role === 'large')).toHaveLength(1);
      expect(card.patches.filter((patch) => patch.role === 'strip')).toHaveLength(6);
    }
  });
});

describe('parseLayout Fehlerfälle', () => {
  it('lehnt falsches Format ab', () => {
    expect(() => parseLayout(null)).toThrow('Ungültiges Layout-Format');
    expect(() => parseLayout({ format: 'x', cards: [] })).toThrow('Ungültiges Layout-Format');
    expect(() => parseLayout({ format: 'cam_gradr-layout/2' })).toThrow('Ungültiges Layout-Format');
  });

  it('lehnt ungültige Karten ab', () => {
    expect(() => parseLayout({ format: 'cam_gradr-layout/2', cards: [1] })).toThrow(
      'Ungültige Karte',
    );
    expect(() =>
      parseLayout({ format: 'cam_gradr-layout/2', cards: [{ card: 'a', patches: [] }] }),
    ).toThrow('Ungültige Karte');
    expect(() =>
      parseLayout({ format: 'cam_gradr-layout/2', cards: [{ card: 1, patches: 5 }] }),
    ).toThrow('Ungültige Karte');
  });

  it('lehnt Felder ohne ID ab', () => {
    expect(() => parseLayout(layoutWith(null))).toThrow('ohne gültige ID');
    expect(() => parseLayout(layoutWith({ id: 5, rect }))).toThrow('ohne gültige ID');
    expect(() => parseLayout(layoutWith({ id: '', rect }))).toThrow('ohne gültige ID');
  });

  it('lehnt fehlende oder ungültige Rechtecke ab', () => {
    expect(() => parseLayout(layoutWith({ id: 'a' }))).toThrow('rect fehlt');
    expect(() => parseLayout(layoutWith({ id: 'a', rect: { ...rect, w: 'x' } }))).toThrow(
      'ungültige Zahlen',
    );
    expect(() => parseLayout(layoutWith({ id: 'a', rect: { ...rect, x: NaN } }))).toThrow(
      'ungültige Zahlen',
    );
  });

  it('lehnt Rechtecke außerhalb der Karte ab', () => {
    for (const bad of [{ w: 0 }, { h: -1 }, { x: -0.1 }, { y: -0.1 }, { x: 0.9 }, { y: 0.9 }]) {
      expect(() => parseLayout(layoutWith({ id: 'a', rect: { ...rect, ...bad } }))).toThrow(
        'nicht innerhalb',
      );
    }
  });

  it('lehnt doppelte IDs ab', () => {
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
    expect(() => parseLayout(doubled)).toThrow('Doppelte Feld-ID');
  });

  it('übernimmt role nur für bekannte Werte', () => {
    const layout = parseLayout(layoutWith({ id: 'a', rect, role: 'large' }));
    expect(layout.cards[0]?.patches[0]?.role).toBe('large');
    expect(
      parseLayout(layoutWith({ id: 'a', rect, role: 'neutral' })).cards[0]?.patches[0]?.role,
    ).toBe('neutral');
    const other = parseLayout(layoutWith({ id: 'a', rect, role: 'foo' }));
    expect(other.cards[0]?.patches[0]).toEqual({ id: 'a', rect });
  });
});
