import { describe, expect, it } from 'vitest';

import {
  DEFAULT_EXPOSURE_CONFIG,
  assessExposure,
  codeLuma,
  describeContrast,
  describeExposure,
} from './exposure';
import type { ExposureInput, Verdict } from './exposure';
import type { Rgb } from './types';

const grey = (value: number): Rgb => [value, value, value];

// Ideale Aufnahme: 18-%-Feld bei 0,46, 50-%-Feld bei 0,74, Streifen unkritisch.
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
  it('liefert für Graustufen den gleichen Wert', () => {
    expect(codeLuma(grey(0.5))).toBeCloseTo(0.5, 6);
    expect(codeLuma(grey(0))).toBe(0);
    expect(codeLuma(grey(1))).toBeCloseTo(1, 6);
  });

  it('gewichtet Grün stärker als Blau', () => {
    expect(codeLuma([0, 1, 0])).toBeGreaterThan(codeLuma([0, 0, 1]));
  });
});

describe('assessExposure', () => {
  it('bewertet eine ideale Aufnahme als ok', () => {
    const result = assessExposure(input());
    expect(result.verdict).toBe('ok');
    expect(result.highlightsClipped).toBe(false);
    expect(result.shadowsCrushed).toBe(false);
    expect(result.delta).toBeCloseTo(0, 3);
  });

  it('erkennt zu helle und zu dunkle Räume über die großen Felder', () => {
    expect(assessExposure(input({ large18: grey(0.6), large50: grey(0.85) })).verdict).toBe(
      'too-bright',
    );
    expect(assessExposure(input({ large18: grey(0.3), large50: grey(0.6) })).verdict).toBe(
      'too-dark',
    );
  });

  it('toleriert Abweichungen innerhalb der Toleranz', () => {
    const edge = DEFAULT_EXPOSURE_CONFIG.tolerance - 0.01;
    expect(
      assessExposure(input({ large18: grey(0.46 + edge), large50: grey(0.74 + edge) })).verdict,
    ).toBe('ok');
  });

  it('meldet geclippte Lichter als zu hell', () => {
    const result = assessExposure(input({ stripLight: [0.99, 0.9, 0.9] }));
    expect(result.highlightsClipped).toBe(true);
    expect(result.verdict).toBe('too-bright');
  });

  it('meldet abgesoffene Schatten als zu dunkel', () => {
    const result = assessExposure(input({ stripDark: grey(0.01) }));
    expect(result.shadowsCrushed).toBe(true);
    expect(result.verdict).toBe('too-dark');
  });

  it('erkennt zu hohen Kontrast, wenn beides zugleich auftritt', () => {
    const result = assessExposure(input({ stripLight: grey(1), stripDark: grey(0) }));
    expect(result.verdict).toBe('high-contrast');
  });

  it('nutzt eine übergebene Konfiguration', () => {
    const strict = { ...DEFAULT_EXPOSURE_CONFIG, tolerance: 0.001 };
    expect(
      assessExposure(input({ large18: grey(0.48), large50: grey(0.76) }), strict).verdict,
    ).toBe('too-bright');
  });
});

describe('Kontrast', () => {
  it('ist bei idealem Abstand der großen Felder null', () => {
    expect(assessExposure(input()).contrast).toBeCloseTo(0, 3);
  });

  it('ist positiv bei zu großem und negativ bei zu kleinem Abstand', () => {
    expect(
      assessExposure(input({ large18: grey(0.4), large50: grey(0.8) })).contrast,
    ).toBeGreaterThan(0.05);
    expect(assessExposure(input({ large18: grey(0.5), large50: grey(0.7) })).contrast).toBeLessThan(
      -0.05,
    );
  });

  it('bleibt bei gleicher Verschiebung beider Felder unverändert (nur die Helligkeit ändert sich)', () => {
    const base = assessExposure(input());
    const brighter = assessExposure(input({ large18: grey(0.56), large50: grey(0.84) }));
    expect(brighter.contrast).toBeCloseTo(base.contrast, 3);
    expect(brighter.delta).toBeGreaterThan(base.delta);
  });

  it('nennt je nach Abweichung einen anderen Hinweis', () => {
    const at = (contrast: number) => ({ ...assessExposure(input()), contrast });
    expect(describeContrast(at(0))).toContain('Normalbereich');
    expect(describeContrast(at(0.1))).toContain('verringert werden');
    expect(describeContrast(at(-0.1))).toContain('erhöht werden');
    expect(describeContrast(at(0.08), 0.1)).toContain('Normalbereich');
  });
});

describe('describeExposure', () => {
  it('liefert für jedes Urteil einen eigenen Text', () => {
    const verdicts: Verdict[] = ['ok', 'too-dark', 'too-bright', 'high-contrast'];
    const texts = verdicts.map((verdict) =>
      describeExposure({
        verdict,
        highlightsClipped: false,
        shadowsCrushed: false,
        level18: 0,
        level50: 0,
        delta: 0,
        contrast: 0,
      }),
    );
    expect(new Set(texts).size).toBe(4);
  });
});
