import { describe, expect, it } from 'vitest';

import type { ExposureResult } from '../chart/exposure';

import {
  detailRows,
  fieldHint,
  fieldPosition,
  fieldTitle,
  isSlight,
  mainIssue,
  OK_BOX,
  SLIGHT_BOX,
} from './measure-field';

const exposure: ExposureResult = {
  verdict: 'ok',
  highlightsClipped: false,
  shadowsCrushed: true,
  level18: 0.46,
  level50: 0.74,
  delta: -0.03,
  contrast: 0,
};

describe('fieldPosition', () => {
  it('sits in the middle at target values', () => {
    expect(fieldPosition({ ...exposure, delta: 0 })).toEqual({ left: 50, top: 50 });
  });

  it('moves up at too high brightness and right at too high contrast', () => {
    const high = fieldPosition({ ...exposure, delta: 0.15, contrast: 0.125 });
    expect(high.top).toBeCloseTo(25, 6);
    expect(high.left).toBeCloseTo(75, 6);
    const low = fieldPosition({ ...exposure, delta: -0.15, contrast: -0.125 });
    expect(low.top).toBeCloseTo(75, 6);
    expect(low.left).toBeCloseTo(25, 6);
  });

  it('stays in the field', () => {
    expect(fieldPosition({ ...exposure, delta: 5, contrast: 5 })).toEqual({ left: 100, top: 0 });
    expect(fieldPosition({ ...exposure, delta: -5, contrast: -5 })).toEqual({ left: 0, top: 100 });
  });
});

describe('OK_BOX and SLIGHT_BOX', () => {
  it('sit in the middle and match the deviations the rating allows', () => {
    expect(OK_BOX.left).toBeCloseTo(40, 6);
    expect(OK_BOX.top).toBeCloseTo(40, 6);
    expect(OK_BOX.width).toBeCloseTo(20, 6);
    expect(OK_BOX.height).toBeCloseTo(20, 6);
    // Twice the tolerances.
    expect(SLIGHT_BOX.left).toBeCloseTo(30, 6);
    expect(SLIGHT_BOX.top).toBeCloseTo(30, 6);
    expect(SLIGHT_BOX.width).toBeCloseTo(40, 6);
    expect(SLIGHT_BOX.height).toBeCloseTo(40, 6);
  });
});

describe('detailRows', () => {
  it('returns all single values readably', () => {
    expect(detailRows(exposure)).toEqual([
      { label: '18 %-Karte', value: '46 % (Soll 46 %)' },
      { label: '50 %-Karte', value: '74 % (Soll 74 %)' },
      { label: 'Helligkeit', value: '−3 Punkte (Toleranz ±6)' },
      { label: 'Kontrast', value: '+0 Punkte (Toleranz ±5)' },
      { label: 'Lichter', value: 'ok' },
      { label: 'Schatten', value: 'unterbelichtet' },
    ]);
  });

  it('shows positive deviation with a plus and clipped highlights', () => {
    const rows = detailRows({ ...exposure, delta: 0.1, highlightsClipped: true });
    expect(rows[2]?.value).toBe('+10 Punkte (Toleranz ±6)');
    expect(rows[4]?.value).toBe('überbelichtet');
  });
});

describe('fieldHint', () => {
  const fine = { ...exposure, shadowsCrushed: false, delta: 0 };

  it('names a missing measurement', () => {
    expect(fieldHint(null)).toBe('Noch keine Messung.');
  });

  it('confirms the normal range', () => {
    expect(fieldHint(fine)).toBe('Helligkeit und Kontrast befinden sich im Normalbereich.');
  });

  it('asks for brightness first at too low or too high brightness', () => {
    expect(fieldHint({ ...fine, delta: -0.2, contrast: 0.1 })).toBe(
      'Helligkeit erhöhen (Beleuchtung verstärken oder Belichtung der Kamera erhöhen). Danach den Kontrast prüfen.',
    );
    expect(fieldHint({ ...fine, delta: 0.2, contrast: -0.1 })).toBe(
      'Helligkeit verringern (Beleuchtung abschwächen oder Belichtung der Kamera verringern). Danach den Kontrast prüfen.',
    );
  });

  it('asks for more brightness first on underexposed shadows, even with too little contrast', () => {
    expect(fieldHint({ ...fine, shadowsCrushed: true, delta: -0.1, contrast: -0.1 })).toContain(
      'Schatten unterbelichtet: erst die Helligkeit erhöhen',
    );
  });

  it('distinguishes brightness and contrast on overexposed highlights', () => {
    expect(fieldHint({ ...fine, highlightsClipped: true, delta: 0.1 })).toContain(
      'Helligkeit verringern',
    );
    expect(fieldHint({ ...fine, highlightsClipped: true, delta: 0 })).toBe(
      'Lichter überbelichtet: Kontrast verringern (Kontrast der Kamera senken oder weicheres Licht verwenden).',
    );
  });

  it('asks for less contrast and more even light at under- and overexposed ends', () => {
    const hint = fieldHint({ ...fine, shadowsCrushed: true, highlightsClipped: true });
    expect(hint).toContain('Kontrast verringern');
    expect(hint).toContain('gleichmäßiger');
  });

  it('names the contrast only once the brightness fits', () => {
    expect(fieldHint({ ...fine, contrast: -0.1 })).toBe(
      'Helligkeit passt. Kontrast erhöhen (Kontrast der Kamera erhöhen).',
    );
    expect(fieldHint({ ...fine, contrast: 0.1 })).toBe(
      'Helligkeit passt. Kontrast verringern (Kontrast der Kamera senken oder weicheres Licht verwenden).',
    );
  });
});

describe('mainIssue', () => {
  const fine = { ...exposure, shadowsCrushed: false, delta: 0 };

  it('reports nothing without a measurement and in the normal range', () => {
    expect(mainIssue(null)).toBeNull();
    expect(mainIssue(fine)).toBeNull();
  });

  it('names the brightness first', () => {
    expect(mainIssue({ ...fine, delta: -0.2, contrast: 0.2 })?.label).toBe('Helligkeit zu niedrig');
    expect(mainIssue({ ...fine, delta: 0.2 })?.label).toBe('Helligkeit zu hoch');
  });

  it('names too low brightness on underexposed shadows', () => {
    expect(mainIssue({ ...fine, shadowsCrushed: true, contrast: -0.1 })?.label).toBe(
      'Helligkeit zu niedrig',
    );
  });

  it('names brightness or contrast on overexposed highlights depending on the deviation', () => {
    expect(mainIssue({ ...fine, highlightsClipped: true, delta: 0.1 })?.label).toBe(
      'Helligkeit zu hoch',
    );
    expect(mainIssue({ ...fine, highlightsClipped: true })?.label).toBe('Kontrast zu hoch');
  });

  it('names the contrast only once the brightness fits', () => {
    expect(mainIssue({ ...fine, contrast: -0.15 })?.label).toBe('Kontrast zu niedrig');
    expect(mainIssue({ ...fine, contrast: 0.15 })?.label).toBe('Kontrast zu hoch');
  });

  it('calls a deviation up to twice the tolerances slight', () => {
    expect(mainIssue({ ...fine, delta: -0.12 })?.label).toBe('Helligkeit leicht zu niedrig');
    expect(mainIssue({ ...fine, delta: 0.1 })?.label).toBe('Helligkeit leicht zu hoch');
    expect(mainIssue({ ...fine, contrast: -0.1 })?.label).toBe('Kontrast leicht zu niedrig');
    expect(mainIssue({ ...fine, contrast: 0.06 })?.label).toBe('Kontrast leicht zu hoch');
  });
});

describe('isSlight', () => {
  const fine = { ...exposure, shadowsCrushed: false, delta: 0 };

  it('holds up to twice the tolerances on both axes', () => {
    expect(isSlight({ ...fine, delta: 0.12, contrast: -0.1 })).toBe(true);
    expect(isSlight({ ...fine, delta: 0.13 })).toBe(false);
    expect(isSlight({ ...fine, contrast: 0.11 })).toBe(false);
  });

  it('never holds with clipped highlights or crushed shadows', () => {
    expect(isSlight({ ...fine, highlightsClipped: true })).toBe(false);
    expect(isSlight({ ...fine, shadowsCrushed: true })).toBe(false);
  });
});

describe('fieldTitle', () => {
  it('names a missing measurement, the next problem or the normal range', () => {
    expect(fieldTitle(null)).toBe('Noch nicht gemessen');
    expect(fieldTitle({ ...exposure, shadowsCrushed: true, delta: -0.2 })).toBe(
      'Helligkeit zu niedrig',
    );
    expect(fieldTitle({ ...exposure, shadowsCrushed: false })).toBe('Belichtung im Normalbereich');
  });
});
