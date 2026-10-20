import { describe, expect, it } from 'vitest';

import { COLOR_IDS } from '../chart/layouts';

import { dummyIds } from './dummy-reference';

describe('dummyIds', () => {
  it('match exactly the field IDs of the color layout', () => {
    expect(new Set(dummyIds())).toEqual(COLOR_IDS);
    expect(dummyIds()).toHaveLength(48);
  });
});
