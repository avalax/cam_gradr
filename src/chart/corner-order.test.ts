import { describe, expect, it } from 'vitest';

import { sortCorners } from './corner-order';
import type { Corners, Point } from './types';

// Perspektivisch verzerrtes Viereck: oben links, oben rechts, unten rechts, unten links.
const expected: Corners = [
  { x: 100, y: 50 },
  { x: 420, y: 80 },
  { x: 380, y: 400 },
  { x: 60, y: 350 },
];

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) {
    return [[...items]];
  }
  return items.flatMap((item, index) =>
    permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [
      item,
      ...rest,
    ]),
  );
}

describe('sortCorners', () => {
  it('lässt eine bereits richtige Reihenfolge unverändert', () => {
    expect(sortCorners(expected)).toEqual(expected);
  });

  it('erkennt die Ecken bei allen 24 Klickreihenfolgen', () => {
    const all = permutations([...expected]);
    expect(all).toHaveLength(24);
    for (const order of all) {
      expect(sortCorners(order as unknown as [Point, Point, Point, Point])).toEqual(expected);
    }
  });

  it('behebt die vertauschte Reihenfolge oben links, unten links, unten rechts, oben rechts', () => {
    const [tl, tr, br, bl] = expected;
    expect(sortCorners([tl, bl, br, tr])).toEqual(expected);
  });
});
