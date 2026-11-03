import { describe, expect, it } from 'vitest';

import { DEFAULT_EXPOSURE_CONFIG, assessExposure, codeLuma } from './exposure';
import type { ExposureInput } from './exposure';
import type { Rgb } from './types';

const grey = (value: number): Rgb => [value, value, value];

// Ideal shot: 18 % patch at 0.46, 50 % patch at 0.74, strips uncritical.
function input(overrides: Partial<ExposureInput> = {}): ExposureInput {
  return {
    large18: grey(0.46),
    large50: grey(0.74),
    stripDark: grey(0.2),
    stripLight: grey(0.85),
    ...overrides,
  };
}

describe('codeLuma', () => {
  it('returns the same value for grays', () => {
    expect(codeLuma(grey(0.5))).toBeCloseTo(0.5, 6);
    expect(codeLuma(grey(0))).toBe(0);
    expect(codeLuma(grey(1))).toBeCloseTo(1, 6);
  });

  it('weights green more strongly than blue', () => {
    expect(codeLuma([0, 1, 0])).toBeGreaterThan(codeLuma([0, 0, 1]));
  });
});

describe('assessExposure', () => {
  it('rates an ideal shot as ok', () => {
    const result = assessExposure(input());
    expect(result.verdict).toBe('ok');
    expect(result.highlightsClipped).toBe(false);
    expect(result.shadowsCrushed).toBe(false);
    expect(result.delta).toBeCloseTo(0, 3);
  });

  it('detects rooms that are too bright or too dark via the large patches', () => {
    expect(assessExposure(input({ large18: grey(0.6), large50: grey(0.85) })).verdict).toBe(
      'too-bright',
    );
    expect(assessExposure(input({ large18: grey(0.3), large50: grey(0.6) })).verdict).toBe(
      'too-dark',
    );
  });

  it('tolerates deviations within the tolerance', () => {
    const edge = DEFAULT_EXPOSURE_CONFIG.tolerance - 0.01;
    expect(
      assessExposure(input({ large18: grey(0.46 + edge), large50: grey(0.74 + edge) })).verdict,
    ).toBe('ok');
  });

  it('reports clipped highlights as too bright', () => {
    const result = assessExposure(input({ stripLight: [0.99, 0.9, 0.9] }));
    expect(result.highlightsClipped).toBe(true);
    expect(result.verdict).toBe('too-bright');
  });

  it('does not count a white strip patch at the target exposure as clipped', () => {
    // A white (L* 96) at the exposure where the 18 % patch reads 0.46.
    const result = assessExposure(input({ stripLight: [0.976, 0.949, 0.933] }));
    expect(result.highlightsClipped).toBe(false);
    expect(result.verdict).toBe('ok');
  });

  it('counts a single channel at the top of the range as clipped', () => {
    expect(assessExposure(input({ stripLight: [1, 0.9, 0.85] })).highlightsClipped).toBe(true);
  });

  it('does not count a dark strip patch that still carries a signal as crushed', () => {
    const result = assessExposure(input({ stripDark: [0.035, 0.026, 0.022] }));
    expect(result.shadowsCrushed).toBe(false);
    expect(result.verdict).toBe('ok');
  });

  it('counts a single channel at the bottom of the range as crushed', () => {
    // Blue no longer carries a signal although the patch as a whole is not black.
    expect(assessExposure(input({ stripDark: [0.05, 0.04, 0.005] })).shadowsCrushed).toBe(true);
  });

  it('reports crushed shadows as too dark', () => {
    const result = assessExposure(input({ stripDark: grey(0.01) }));
    expect(result.shadowsCrushed).toBe(true);
    expect(result.verdict).toBe('too-dark');
  });

  it('detects too much contrast when both occur at once', () => {
    const result = assessExposure(input({ stripLight: grey(1), stripDark: grey(0) }));
    expect(result.verdict).toBe('high-contrast');
  });

  it('rates the contrast once the brightness is right, like the measuring field', () => {
    // Both large patches are as bright as they should be on average, but too far apart or too close.
    expect(assessExposure(input({ large18: grey(0.41), large50: grey(0.79) })).verdict).toBe(
      'high-contrast',
    );
    expect(assessExposure(input({ large18: grey(0.5), large50: grey(0.7) })).verdict).toBe(
      'low-contrast',
    );
    expect(assessExposure(input({ large18: grey(0.44), large50: grey(0.76) })).verdict).toBe('ok');
  });

  it('names the brightness first when both brightness and contrast are off', () => {
    expect(assessExposure(input({ large18: grey(0.5), large50: grey(0.95) })).verdict).toBe(
      'too-bright',
    );
  });

  it('uses a passed configuration', () => {
    const strict = { ...DEFAULT_EXPOSURE_CONFIG, tolerance: 0.001 };
    expect(
      assessExposure(input({ large18: grey(0.48), large50: grey(0.76) }), strict).verdict,
    ).toBe('too-bright');
  });
});

describe('Kontrast', () => {
  it('is zero at the ideal distance of the large patches', () => {
    expect(assessExposure(input()).contrast).toBeCloseTo(0, 3);
  });

  it('is positive for too large and negative for too small a distance', () => {
    expect(
      assessExposure(input({ large18: grey(0.4), large50: grey(0.8) })).contrast,
    ).toBeGreaterThan(0.05);
    expect(assessExposure(input({ large18: grey(0.5), large50: grey(0.7) })).contrast).toBeLessThan(
      -0.05,
    );
  });

  it('stays unchanged when both patches shift equally (only the brightness changes)', () => {
    const base = assessExposure(input());
    const brighter = assessExposure(input({ large18: grey(0.56), large50: grey(0.84) }));
    expect(brighter.contrast).toBeCloseTo(base.contrast, 3);
    expect(brighter.delta).toBeGreaterThan(base.delta);
  });
});
