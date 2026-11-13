import { describe, expect, it } from 'vitest';

import { assessExposure } from '../chart/exposure';
import type { ExposureResult } from '../chart/exposure';

import { colorStatus, grayStatus } from './tab-status';

function exposure(overrides: Partial<ExposureResult>): ExposureResult {
  return {
    verdict: 'ok',
    highlightsClipped: false,
    shadowsCrushed: false,
    level18: 0.46,
    level50: 0.74,
    delta: 0,
    contrast: 0,
    ...overrides,
  };
}

describe('grayStatus', () => {
  it('is open without a measurement', () => {
    expect(grayStatus(null)).toEqual({
      level: 'off',
      fill: 0,
      text: 'Noch nicht gemessen',
      rating: null,
    });
  });

  it('is very good in the normal range', () => {
    expect(grayStatus(exposure({}))).toEqual({
      level: 'ok',
      fill: 4,
      text: 'Belichtung im Normalbereich',
      rating: 'sehr gut',
    });
  });

  it('is still good and green just outside the normal range, and says so', () => {
    // Up to twice the tolerances: brightness ±0.12, contrast ±0.10.
    expect(grayStatus(exposure({ verdict: 'low-contrast', contrast: -0.06 }))).toEqual({
      level: 'ok',
      fill: 3,
      text: 'Kontrast leicht zu niedrig',
      rating: 'gut',
    });
    const dark = grayStatus(exposure({ verdict: 'too-dark', delta: -0.12, contrast: 0.1 }));
    expect(dark).toMatchObject({ fill: 3, text: 'Helligkeit leicht zu niedrig' });
  });

  it('counts the contrast as much as the brightness', () => {
    const flat = grayStatus(exposure({ verdict: 'too-bright', delta: 0.08, contrast: -0.15 }));
    expect(flat).toEqual({
      level: 'warn',
      fill: 2,
      text: 'Helligkeit zu hoch',
      rating: 'brauchbar',
    });
  });

  it('is fair further out, with the most important hint', () => {
    const status = grayStatus(exposure({ verdict: 'too-dark', delta: -0.2 }));
    expect(status).toMatchObject({ level: 'warn', fill: 2, text: 'Helligkeit zu niedrig' });
  });

  it('is poor and red for clipped highlights or crushed shadows, however close the rest is', () => {
    const clipped = grayStatus(exposure({ verdict: 'too-bright', highlightsClipped: true }));
    expect(clipped).toMatchObject({ level: 'bad', fill: 1, rating: 'schwach' });
    const crushed = grayStatus(exposure({ verdict: 'too-dark', shadowsCrushed: true }));
    expect(crushed).toMatchObject({ level: 'bad', fill: 1, text: 'Helligkeit zu niedrig' });
  });

  it('follows the assessment of a real measurement', () => {
    const grey = (value: number) => [value, value, value] as const;
    const status = grayStatus(
      assessExposure({
        large18: grey(0.41),
        large50: grey(0.78),
        stripDark: grey(0.2),
        stripLight: grey(0.85),
      }),
    );
    expect(status).toMatchObject({ level: 'ok', fill: 3, text: 'Kontrast leicht zu hoch' });
  });
});

describe('colorStatus', () => {
  it('is open as long as nothing is computed', () => {
    expect(colorStatus(null, false)).toEqual({
      level: 'off',
      fill: 0,
      text: 'Noch nicht berechnet',
      rating: null,
    });
  });

  it('says that a correction without a report has no report', () => {
    expect(colorStatus(null, true)).toEqual({
      level: 'off',
      fill: 0,
      text: 'Ohne Bericht',
      rating: null,
    });
  });

  it('is very good up to a mean deviation of 3 and good up to 4, both green', () => {
    expect(colorStatus({ meanBefore: 5.1, meanAfter: 3 }, true)).toEqual({
      level: 'ok',
      fill: 4,
      text: 'Ø 5,1 → 3,0',
      rating: 'sehr gut',
    });
    expect(colorStatus({ meanBefore: 9, meanAfter: 4 }, true)).toMatchObject({
      level: 'ok',
      fill: 3,
      rating: 'gut',
    });
  });

  it('is fair and yellow up to 6, poor and red above', () => {
    expect(colorStatus({ meanBefore: 20.2, meanAfter: 6 }, true)).toEqual({
      level: 'warn',
      fill: 2,
      text: 'Ø 20,2 → 6,0',
      rating: 'brauchbar',
    });
    expect(colorStatus({ meanBefore: 20.2, meanAfter: 6.1 }, true)).toMatchObject({
      level: 'bad',
      fill: 1,
      rating: 'schwach',
    });
  });
});
