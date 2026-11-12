import { describe, expect, it } from 'vitest';

import { labToSrgb } from '../color/lab';
import { NEUTRAL_IDS, colorLayout } from '../chart/layouts';
import { applyColorModel, targetLab } from '../solve/fit';
import type { ColorModel, FitResult } from '../solve/fit';
import { IDENTITY_MODEL } from '../test-support/identity-model';

import { cssColor } from './color-css';
import {
  byRowThenColumn,
  colorCards,
  deviationSummary,
  wedgeRows,
  worstPatches,
  zoneChanges,
  zoneColumns,
  zonePoints,
} from './gray-wedge';

const IDENTITY = IDENTITY_MODEL;
// The red channel is raised (black 0 → 0.3 in linear light); green and blue stay.
const RED_LIFT: ColorModel = {
  ...IDENTITY,
  curves: [{ xs: [0, 1], ys: [0.3, 1] }, IDENTITY.curves[1], IDENTITY.curves[2]],
};
const REFERENCE = { name: 'Test', patches: { '1D': [90, 0, 0] as const } };

describe('wedgeRows', () => {
  it('returns no gray wedge without a model', () => {
    expect(wedgeRows({ '1D': [0.5, 0.5, 0.5] }, null, REFERENCE, 1)).toEqual([]);
  });

  it('takes only measured neutral patches and sorts them from light to dark', () => {
    const rows = wedgeRows(
      { '1A': [0.5, 0.5, 0.5], '1D': [0.2, 0.2, 0.2], '3D': [0.8, 0.8, 0.8] },
      IDENTITY,
      REFERENCE,
      1,
    );
    expect(rows.map((row) => row.id)).toEqual(['3D', '1D']);
  });

  it('gives camera, corrected color and, with a reference, the target', () => {
    const [row] = wedgeRows({ '1D': [0.2, 0.2, 0.2] }, RED_LIFT, REFERENCE, 1);
    expect(row?.camera).toBe('rgb(51, 51, 51)');
    expect(row?.corrected).toBe(cssColor(applyColorModel(RED_LIFT, [0.2, 0.2, 0.2])));
    expect(row?.corrected).not.toBe(row?.camera);
    expect(row?.target).toBe(cssColor(labToSrgb([90, 0, 0])));
  });

  it('shows the target at the exposure of the shot, like the report', () => {
    const [row] = wedgeRows({ '1D': [0.2, 0.2, 0.2] }, IDENTITY, REFERENCE, 0.5);
    expect(row?.target).toBe(cssColor(labToSrgb(targetLab([90, 0, 0], 0.5))));
    expect(row?.target).not.toBe(cssColor(labToSrgb([90, 0, 0])));
  });

  it('omits the target when the patch has no reference value', () => {
    const rows = wedgeRows({ '2D': [0.5, 0.5, 0.5] }, IDENTITY, null, 1);
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
  const measured = Object.fromEntries(
    colorLayout.cards.flatMap((card) =>
      card.patches.map((patch) => [patch.id, [0.4, 0.4, 0.4] as const]),
    ),
  );

  it('returns nothing without a model', () => {
    expect(colorCards(measured, null, null, 1)).toEqual([]);
  });

  it('returns the colored patches per card in card order and omits neutral patches', () => {
    const cards = colorCards(measured, IDENTITY, null, 1);
    expect(cards).toHaveLength(2);
    expect(cards[0]?.slice(0, 4).map((row) => row.id)).toEqual(['1A', '1B', '1C', '2A']);
    expect(cards.flat().some((row) => NEUTRAL_IDS.has(row.id))).toBe(false);
    expect(cards.flat()).toHaveLength(36);
  });

  it('omits patches without a measurement and cards without measured colored patches', () => {
    const onlyFirst = { '1A': [0.4, 0.4, 0.4] as const };
    const cards = colorCards(onlyFirst, IDENTITY, null, 1);
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
      patch('5D', 1, false),
    ],
  } as unknown as FitResult['report'];

  it('lists the three colored patches with the largest deviation first, without neutral ones', () => {
    expect(worstPatches(report)).toEqual([
      { id: '3B', deviation: 9 },
      { id: '4C', deviation: 5 },
      { id: '1A', deviation: 2 },
    ]);
  });
});

describe('zoneChanges', () => {
  // Brightening, red, green, blue.
  const values = (zone: { values: number[] } | undefined) => zone?.values ?? [];

  it('reports no change in all three ranges for the identity', () => {
    const changes = zoneChanges(IDENTITY);
    expect(changes.map((zone) => zone.name)).toEqual(['Schatten', 'Mitten', 'Lichter']);
    for (const zone of changes) {
      expect(zone.values).toHaveLength(4);
      for (const value of zone.values) {
        expect(value).toBeCloseTo(0, 6);
      }
    }
  });

  it('brightens with a raised red channel, which gets stronger while green and blue get weaker', () => {
    const [brighter = 0, red = 0, green = 0, blue = 0] = values(zoneChanges(RED_LIFT)[0]);
    expect(brighter).toBeGreaterThan(0);
    expect(red).toBeGreaterThan(0);
    expect(green).toBeLessThan(0);
    expect(green).toBeCloseTo(blue, 6);
    // The shifts are relative to the brightening: together they make no change.
    expect(red + green + blue).toBeCloseTo(0, 6);
  });

  it('shifts the color most in the shadows and least in the highlights', () => {
    const [shadows = 0, mids = 0, lights = 0] = zoneChanges(RED_LIFT).map(
      (zone) => values(zone)[1] ?? 0,
    );
    expect(shadows).toBeGreaterThan(mids);
    expect(mids).toBeGreaterThan(lights);
  });

  it('names its columns short for the head and in full for screen readers', () => {
    expect(zoneColumns().map((column) => [column.short, column.name])).toEqual([
      ['Hell', 'Helligkeit'],
      ['R', 'Rot'],
      ['G', 'Grün'],
      ['B', 'Blau'],
    ]);
  });
});

describe('texts', () => {
  it('writes whole points with a sign, and no change as a plain 0', () => {
    expect(zonePoints(3.4)).toBe('+3');
    expect(zonePoints(-2.2)).toBe('−2');
    expect(zonePoints(0.4)).toBe('0');
    expect(zonePoints(-0.4)).toBe('0');
  });

  it('names the deviation before and after with a comma', () => {
    expect(deviationSummary({ meanBefore: 18.44, meanAfter: 8.04 })).toBe(
      'Ø Abweichung 18,4 → 8,0',
    );
  });
});
