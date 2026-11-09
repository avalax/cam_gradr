import { describe, expect, it } from 'vitest';

import colorJson from '../data/layouts/spyder-checkr-photo-color.layout.json';
import grayJson from '../data/layouts/spyder-checkr-photo-gray.layout.json';
import { isRecord } from '../storage/json';

import { COLOR_IDS, GRAY_IDS, NEUTRAL_IDS, colorLayout, grayLayout } from './layouts';
import type { ChartLayout } from './types';

const ROLES = new Set<unknown>(['large', 'strip', 'neutral']);

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

// A number of a rectangle; a missing or invalid one reads as NaN, which fails every comparison.
function coordinate(rect: Record<string, unknown>, key: string): number {
  const value = rect[key];
  return isNumber(value) ? value : NaN;
}

// A rectangle with a size, inside the card (0..1).
function isInsideCard(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  const [x, y, w, h] = [
    coordinate(value, 'x'),
    coordinate(value, 'y'),
    coordinate(value, 'w'),
    coordinate(value, 'h'),
  ];
  return w > 0 && h > 0 && x >= 0 && y >= 0 && x + w <= 1 && y + h <= 1;
}

function isLab(value: unknown): boolean {
  return Array.isArray(value) && value.length === 3 && value.every((number_) => isNumber(number_));
}

// What is wrong with one patch; `seen` collects the IDs, which must be unique across the file.
function patchProblems(patch: unknown, card: string, seen: Set<string>): string[] {
  if (!isRecord(patch) || typeof patch.id !== 'string' || patch.id === '') {
    return [`card ${card}: a patch without an ID`];
  }
  const { id } = patch;
  const problems = [
    seen.has(id) && `${id}: the ID occurs twice`,
    !isInsideCard(patch.rect) && `${id}: the rect is not inside the card`,
    patch.role !== undefined && !ROLES.has(patch.role) && `${id}: unknown role`,
    patch.nominalLab !== undefined && !isLab(patch.nominalLab) && `${id}: nominalLab is no Lab`,
  ];
  seen.add(id);
  return problems.filter((problem) => problem !== false);
}

function cardProblems(card: unknown, seen: Set<string>): string[] {
  if (!isRecord(card) || !Number.isSafeInteger(card.card) || !Array.isArray(card.patches)) {
    return ['a card without a number or patches'];
  }
  return (card.patches as unknown[]).flatMap((patch) =>
    patchProblems(patch, String(card.card), seen),
  );
}

// What is wrong with a layout file (format cam_gradr-layout/2); empty for a sound one. The app takes
// the bundled files as they are, so this check stands in for a parser.
function layoutProblems(file: unknown): string[] {
  if (!isRecord(file) || file.format !== 'cam_gradr-layout/2' || !Array.isArray(file.cards)) {
    return ['no layout file'];
  }
  const seen = new Set<string>();
  return (file.cards as unknown[]).flatMap((card) => cardProblems(card, seen));
}

function ids(layout: ChartLayout, card: number): string[] {
  return layout.cards.find((entry) => entry.card === card)?.patches.map((patch) => patch.id) ?? [];
}

function withRole(layout: ChartLayout, role: string): string[] {
  return layout.cards.flatMap((card) =>
    card.patches.filter((patch) => patch.role === role).map((patch) => patch.id),
  );
}

// The IDs of a color card: row 1 to 6 of each column.
function grid(...columns: string[]): string[] {
  return columns.flatMap((column) => [1, 2, 3, 4, 5, 6].map((row) => `${String(row)}${column}`));
}

describe('the bundled layout files', () => {
  it('are sound: shapes, card numbers, unique patch IDs, rects inside the card, known roles', () => {
    expect(layoutProblems(grayJson)).toEqual([]);
    expect(layoutProblems(colorJson)).toEqual([]);
  });

  it('describe the color cards: 2 cards with 24 patches each, 12 of them neutral', () => {
    expect(colorLayout.cards.map((card) => card.card)).toEqual([1, 2]);
    expect(ids(colorLayout, 1)).toEqual(grid('A', 'B', 'C', 'D'));
    expect(ids(colorLayout, 2)).toEqual(grid('E', 'F', 'G', 'H'));
    // The two gray ladders: columns D and E.
    expect(withRole(colorLayout, 'neutral')).toEqual([...grid('D'), ...grid('E')]);
    expect([...NEUTRAL_IDS]).toEqual([...grid('D'), ...grid('E')]);
    expect(COLOR_IDS.size).toBe(48);
  });

  it('describe the gray cards: one large patch and a strip of six, top black to bottom white', () => {
    expect(grayLayout.cards.map((card) => card.card)).toEqual([3, 4]);
    const strip = (card: number) =>
      [0, 1, 2, 3, 4, 5].map((index) => `S${String(card)}-${String(index)}`);
    expect(ids(grayLayout, 3)).toEqual(['G50', ...strip(3)]);
    expect(ids(grayLayout, 4)).toEqual(['G18', ...strip(4)]);
    expect(withRole(grayLayout, 'large')).toEqual(['G50', 'G18']);
    expect(withRole(grayLayout, 'strip')).toEqual([...strip(3), ...strip(4)]);
    expect([...GRAY_IDS]).toEqual(['G50', ...strip(3), 'G18', ...strip(4)]);
  });

  it('give the nominal Lab of the large gray patches only', () => {
    const nominal = Object.fromEntries(
      grayLayout.cards.flatMap((card) => card.patches.map((patch) => [patch.id, patch.nominalLab])),
    );
    expect(nominal.G50).toEqual([76.07, 0, 0]);
    expect(nominal.G18).toEqual([49.5, 0, 0]);
    expect(nominal['S3-0']).toBeUndefined();
  });
});

describe('the check of a layout file', () => {
  const rect = { x: 0.1, y: 0.1, w: 0.2, h: 0.2 };
  const withPatches = (...patches: unknown[]) => ({
    format: 'cam_gradr-layout/2',
    cards: [{ card: 1, patches }],
  });

  it('finds what a broken file gets wrong', () => {
    expect(layoutProblems(null)).toEqual(['no layout file']);
    expect(layoutProblems({ format: 'x', cards: [] })).toEqual(['no layout file']);
    expect(
      layoutProblems({ format: 'cam_gradr-layout/2', cards: [{ card: 'a', patches: [] }] }),
    ).toEqual(['a card without a number or patches']);
    expect(layoutProblems(withPatches({ rect }, { id: '', rect }))).toHaveLength(2);
    expect(layoutProblems(withPatches({ id: 'a', rect }, { id: 'a', rect }))).toEqual([
      'a: the ID occurs twice',
    ]);
    for (const bad of [
      undefined,
      { ...rect, w: 'x' },
      { ...rect, x: NaN },
      { ...rect, w: 0 },
      { ...rect, x: -0.1 },
      { ...rect, y: 0.9 },
    ]) {
      expect(layoutProblems(withPatches({ id: 'a', rect: bad }))).toEqual([
        'a: the rect is not inside the card',
      ]);
    }
    expect(layoutProblems(withPatches({ id: 'a', rect, role: 'foo' }))).toEqual([
      'a: unknown role',
    ]);
    expect(layoutProblems(withPatches({ id: 'a', rect, nominalLab: [1, 2] }))).toEqual([
      'a: nominalLab is no Lab',
    ]);
    expect(
      layoutProblems(withPatches({ id: 'a', rect, role: 'neutral', nominalLab: [1, 2, 3] })),
    ).toEqual([]);
  });
});
