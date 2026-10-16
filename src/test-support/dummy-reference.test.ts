import { describe, expect, it } from 'vitest';

import { COLOR_IDS } from '../chart/layouts';

import { dummyIds } from './dummy-reference';

describe('dummyIds', () => {
  it('entsprechen genau den Feld-IDs des Farblayouts', () => {
    expect(new Set(dummyIds())).toEqual(COLOR_IDS);
    expect(dummyIds()).toHaveLength(48);
  });
});
