import { describe, expect, it } from 'vitest';

import { COLOR_IDS } from '../chart/layouts';

import { BUNDLED_NAME, BUNDLED_SOURCE_URL, bundledReference } from './bundled';

describe('mitgelieferter Referenzsatz', () => {
  it('is a valid set with all 48 color fields', () => {
    const set = bundledReference();
    expect(set.name).toBe(BUNDLED_NAME);
    expect(Object.keys(set.patches).toSorted((a, b) => a.localeCompare(b))).toEqual(
      [...COLOR_IDS].toSorted((a, b) => a.localeCompare(b)),
    );
  });

  it('names the blog post as the source', () => {
    expect(BUNDLED_SOURCE_URL).toBe(
      'https://www.bartneck.de/2017/10/24/patch-color-definitions-for-datacolor-spydercheckr-48/',
    );
  });
});
