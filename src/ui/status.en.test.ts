import { describe, expect, it } from 'vitest';

import { setLocale } from '../lang';

import { cubeSizeText } from './lut-slices';
import { colorStatus, grayStatus } from './tab-status';

describe('status texts in English', () => {
  it('names the gray card status in English', () => {
    setLocale('en');
    expect(grayStatus(null).text).toBe('Not measured yet');
    expect(
      grayStatus({
        verdict: 'ok',
        highlightsClipped: false,
        shadowsCrushed: false,
        level18: 0.46,
        level50: 0.74,
        delta: 0,
        contrast: 0,
      }).text,
    ).toBe('Lighting is fine');
  });

  it('names the color card status in English', () => {
    setLocale('en');
    expect(colorStatus(null).text).toBe('Not computed yet');
    expect(colorStatus({ meanBefore: 5.1, meanAfter: 0.4 }).text).toContain('→');
  });

  it('writes the file size in English', () => {
    setLocale('en');
    expect(cubeSizeText(33)).toBe('about 970 KB');
    expect(cubeSizeText(65)).toBe('about 7.4 MB');
  });
});
