import { describe, expect, it } from 'vitest';

import { labToSrgb } from '../color/lab';
import { colorLayout } from '../chart/layouts';
import { applyColorModel } from '../solve/fit';
import type { ColorModel, FitResult } from '../solve/fit';
import { setLocale } from '../lang';

import { cssColor } from './color-css';
import {
  brightnessText,
  byRowThenColumn,
  colorCards,
  deviationSummary,
  oneDecimal,
  signedPoints,
  wedgeRows,
  worstPatches,
  zoneChanges,
} from './gray-wedge';

const IDENTITY: ColorModel = {
  curves: [
    { xs: [0, 1], ys: [0, 1] },
    { xs: [0, 1], ys: [0, 1] },
    { xs: [0, 1], ys: [0, 1] },
  ],
  matrix: [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
};
// The red channel is raised (black 0 → 0.3 in linear light); green and blue stay.
const RED_LIFT: ColorModel = {
  ...IDENTITY,
  curves: [{ xs: [0, 1], ys: [0.3, 1] }, IDENTITY.curves[1], IDENTITY.curves[2]],
};
const IDS = new Set(['1D', '2D', '3D']);
const REFERENCE = { name: 'Test', patches: { '1D': [90, 0, 0] as const } };

describe('wedgeRows', () => {
  it('returns no gray wedge without a model', () => {
    expect(wedgeRows(IDS, { '1D': [0.5, 0.5, 0.5] }, null, REFERENCE)).toEqual([]);
  });

  it('takes only measured patches and sorts them from light to dark', () => {
    const rows = wedgeRows(
      IDS,
      { '1D': [0.2, 0.2, 0.2], '3D': [0.8, 0.8, 0.8] },
      IDENTITY,
      REFERENCE,
    );
    expect(rows.map((row) => row.id)).toEqual(['3D', '1D']);
  });

  it('gives camera, corrected color and, with a reference, the target', () => {
    const [row] = wedgeRows(IDS, { '1D': [0.2, 0.2, 0.2] }, RED_LIFT, REFERENCE);
    expect(row?.camera).toBe('rgb(51, 51, 51)');
    expect(row?.corrected).toBe(cssColor(applyColorModel(RED_LIFT, [0.2, 0.2, 0.2])));
    expect(row?.corrected).not.toBe(row?.camera);
    expect(row?.target).toBe(cssColor(labToSrgb([90, 0, 0])));
  });

  it('omits the target when the patch has no reference value', () => {
    const rows = wedgeRows(IDS, { '2D': [0.5, 0.5, 0.5] }, IDENTITY, null);
    expect(rows[0]?.target).toBeNull();
  });
});

describe('byRowThenColumn', () => {
  it('sorts row by row from A to H', () => {
    expect(['2A', '1B', '1A', '10A', '2B'].toSorted(byRowThenColumn)).toEqual([
      '1A',
      '1B',
      '2A',
      '2B',
      '10A',
    ]);
  });
});

describe('colorCards', () => {
  const NEUTRAL = new Set(['1D', '1E']);
  const measured = Object.fromEntries(
    colorLayout.cards.flatMap((card) =>
      card.patches.map((patch) => [patch.id, [0.4, 0.4, 0.4] as const]),
    ),
  );

  it('returns nothing without a model', () => {
    expect(colorCards(colorLayout, NEUTRAL, measured, null, null)).toEqual([]);
  });

  it('returns the colored patches per card in card order and omits neutral patches', () => {
    const cards = colorCards(colorLayout, NEUTRAL, measured, IDENTITY, null);
    expect(cards).toHaveLength(2);
    expect(cards[0]?.slice(0, 4).map((row) => row.id)).toEqual(['1A', '1B', '1C', '2A']);
    expect(cards.flat().some((row) => NEUTRAL.has(row.id))).toBe(false);
    expect(cards.flat()).toHaveLength(46);
  });

  it('omits patches without a measurement and cards without measured colored patches', () => {
    const onlyFirst = { '1A': [0.4, 0.4, 0.4] as const };
    const cards = colorCards(colorLayout, NEUTRAL, onlyFirst, IDENTITY, null);
    expect(cards).toHaveLength(1);
    expect(cards[0]?.map((row) => row.id)).toEqual(['1A']);
  });
});

describe('worstPatches', () => {
  const patch = (id: string, after: number, neutral: boolean) => ({
    id,
    reference: [0, 0, 0] as const,
    measured: [0, 0, 0] as const,
    before: 1,
    after,
    neutral,
  });
  const report = {
    patches: [
      patch('1A', 2, false),
      patch('2E', 20, true),
      patch('3B', 9, false),
      patch('4C', 5, false),
    ],
  } as unknown as FitResult['report'];

  it('lists the colored patches with the largest deviation first and skips neutral patches', () => {
    expect(worstPatches(report, 2)).toEqual([
      { id: '3B', deviation: 9 },
      { id: '4C', deviation: 5 },
    ]);
  });
});

describe('zoneChanges', () => {
  it('reports no change in all three ranges for the identity', () => {
    const changes = zoneChanges(IDENTITY);
    expect(changes.map((zone) => zone.name)).toEqual(['Schatten', 'Mitten', 'Lichter']);
    for (const zone of changes) {
      expect(zone.brighter).toBeCloseTo(0, 6);
      expect(zone.casts).toEqual([]);
    }
  });

  it('brightens with a raised red channel and names red first', () => {
    const [shadows] = zoneChanges(RED_LIFT);
    expect(shadows?.brighter).toBeGreaterThan(0);
    expect(shadows?.casts[0]?.channel).toBe('Rot');
    expect(shadows?.casts[0]?.points).toBeGreaterThan(0);
  });

  it('makes green and blue weaker in the process', () => {
    const [shadows] = zoneChanges(RED_LIFT);
    expect(shadows?.casts.slice(1).map((cast) => cast.channel)).toEqual(['Grün', 'Blau']);
    expect(shadows?.casts.slice(1).every((cast) => cast.points < 0)).toBe(true);
  });

  it('shifts the color most in the shadows and least in the highlights', () => {
    const [shadows, mids, lights] = zoneChanges(RED_LIFT);
    const red = (zone: typeof shadows) => zone?.casts[0]?.points ?? 0;
    expect(red(shadows)).toBeGreaterThan(red(mids));
    expect(red(mids)).toBeGreaterThan(red(lights));
  });

  it('ignoriert Verschiebungen unter 1,5 Punkten', () => {
    const faint: ColorModel = {
      ...IDENTITY,
      curves: [{ xs: [0, 1], ys: [0.0005, 1] }, IDENTITY.curves[1], IDENTITY.curves[2]],
    };
    expect(zoneChanges(faint)[0]?.casts).toEqual([]);
  });
});

describe('Texte', () => {
  it('writes points with a sign', () => {
    expect(signedPoints(3.4)).toBe('+3');
    expect(signedPoints(-2.2)).toBe('−2');
    expect(signedPoints(0)).toBe('+0');
  });

  it('describes the brightening in words', () => {
    expect(brightnessText(12.6)).toBe('13 heller');
    expect(brightnessText(-4.6)).toBe('5 dunkler');
    expect(brightnessText(0.2)).toBe('gleich hell');
  });

  it('names the deviation before and after with a comma', () => {
    expect(deviationSummary({ meanBefore: 18.44, meanAfter: 8.04 })).toBe(
      'Ø Abweichung 18,4 → 8,0',
    );
  });
});

describe('Englische Texte', () => {
  it('names tonal ranges and channels in English', () => {
    setLocale('en');
    const changes = zoneChanges(RED_LIFT);
    expect(changes.map((zone) => zone.name)).toEqual(['Shadows', 'Midtones', 'Highlights']);
    expect(changes[0]?.casts.map((cast) => cast.channel)).toEqual(['Red', 'Green', 'Blue']);
    expect(changes[0]?.casts.map((cast) => cast.key)).toEqual(['red', 'green', 'blue']);
  });

  it('writes points, brightening and deviation in English', () => {
    setLocale('en');
    expect(signedPoints(-2.2)).toBe('−2');
    expect(brightnessText(12.6)).toBe('13 brighter');
    expect(brightnessText(-4.6)).toBe('5 darker');
    expect(brightnessText(0.2)).toBe('same brightness');
    expect(oneDecimal(5.1)).toBe('5.1');
    expect(deviationSummary({ meanBefore: 18.44, meanAfter: 8.04 })).toBe('Ø deviation 18.4 → 8.0');
  });
});
