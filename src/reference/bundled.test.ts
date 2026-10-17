import { describe, expect, it } from 'vitest';

import { COLOR_IDS, NEUTRAL_IDS } from '../chart/layouts';

import { BUNDLED_NAME, BUNDLED_SOURCE_URL, bundledReferenceText } from './bundled';
import { parseReferenceJson } from './reference';

describe('mitgelieferter Referenzsatz', () => {
  it('ist ein gültiger Satz mit allen 48 Farbfeldern', () => {
    const set = parseReferenceJson(bundledReferenceText(), {
      knownIds: COLOR_IDS,
      neutralIds: NEUTRAL_IDS,
    });
    expect(set.name).toBe(BUNDLED_NAME);
    expect(Object.keys(set.patches).toSorted((a, b) => a.localeCompare(b))).toEqual(
      [...COLOR_IDS].toSorted((a, b) => a.localeCompare(b)),
    );
  });

  it('nennt den Blogbeitrag als Quelle', () => {
    expect(BUNDLED_SOURCE_URL).toBe(
      'https://www.bartneck.de/2017/10/24/patch-color-definitions-for-datacolor-spydercheckr-48/',
    );
  });
});
