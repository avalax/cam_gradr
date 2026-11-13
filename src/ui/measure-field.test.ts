import { describe, expect, it } from 'vitest';

import type { ExposureResult } from '../chart/exposure';

import {
  detailRows,
  fieldHint,
  fieldPosition,
  fieldRanges,
  fieldTitle,
  isSlight,
  mainIssue,
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

  it('zooms out in steps for a measurement near or beyond the edge, so that the dot stays inside', () => {
    // Contrast +26 points, the field reaches ±25: twice the range.
    const far = fieldPosition({ ...exposure, delta: -0.015, contrast: 0.26 });
    expect(far.left).toBeCloseTo(76, 6);
    expect(far.top).toBeCloseTo(51.25, 6);
    // Up to 85 % of the half the scale stays.
    expect(fieldPosition({ ...exposure, delta: 0, contrast: 0.21 }).left).toBeCloseTo(92, 6);
    expect(fieldPosition({ ...exposure, delta: -0.6, contrast: 0 }).top).toBeCloseTo(75, 6);
  });

  it('stays in the field beyond the widest zoom', () => {
    expect(fieldPosition({ ...exposure, delta: 5, contrast: 5 })).toEqual({ left: 100, top: 0 });
    expect(fieldPosition({ ...exposure, delta: -5, contrast: -5 })).toEqual({ left: 0, top: 100 });
  });
});

describe('fieldRanges', () => {
  it('sit in the middle and match the deviations the rating allows', () => {
    const { ok, slight } = fieldRanges(null);
    expect(ok).toEqual({ left: 40, top: 40, width: 20, height: 20 });
    // Twice the tolerances.
    expect(slight.left).toBeCloseTo(30, 6);
    expect(slight.top).toBeCloseTo(30, 6);
    expect(slight.width).toBeCloseTo(40, 6);
    expect(slight.height).toBeCloseTo(40, 6);
  });

  it('shrink as the field zooms out', () => {
    const { ok, slight } = fieldRanges({ ...exposure, contrast: 0.26 });
    expect(ok).toEqual({ left: 45, top: 45, width: 10, height: 10 });
    expect(slight.width).toBeCloseTo(20, 6);
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

  it('says that nothing needs to change in the normal range', () => {
    expect(fieldHint(fine)).toBe('Keine Änderung nötig.');
  });

  it('names only the next step, brightness first', () => {
    expect(fieldHint({ ...fine, delta: -0.2, contrast: 0.1 })).toBe(
      'Licht verstärken oder Belichtung der Kamera erhöhen.',
    );
    expect(fieldHint({ ...fine, delta: 0.2, contrast: -0.1 })).toBe(
      'Licht abschwächen oder Belichtung der Kamera verringern.',
    );
  });

  it('treats a cut-off end as brightness while the large patches are off towards it', () => {
    expect(fieldHint({ ...fine, shadowsCrushed: true, delta: -0.1, contrast: -0.1 })).toBe(
      'Licht verstärken oder Belichtung der Kamera erhöhen.',
    );
    expect(fieldHint({ ...fine, highlightsClipped: true, delta: 0.1 })).toBe(
      'Licht abschwächen oder Belichtung der Kamera verringern.',
    );
  });

  it('treats a cut-off end as contrast while the brightness fits', () => {
    const contrast = 'Kontrast der Kamera senken oder weicheres Licht verwenden.';
    expect(fieldHint({ ...fine, shadowsCrushed: true, delta: -0.015, contrast: 0.26 })).toBe(
      contrast,
    );
    expect(fieldHint({ ...fine, highlightsClipped: true, delta: 0 })).toBe(contrast);
  });

  it('asks for less contrast and more even light at under- and overexposed ends', () => {
    expect(fieldHint({ ...fine, shadowsCrushed: true, highlightsClipped: true })).toBe(
      'Kontrast senken, Licht gleichmäßiger ausrichten, Reflexe auf der Karte vermeiden.',
    );
  });

  it('names the contrast once the brightness fits', () => {
    expect(fieldHint({ ...fine, contrast: -0.1 })).toBe('Kontrast der Kamera erhöhen.');
    expect(fieldHint({ ...fine, contrast: 0.1 })).toBe(
      'Kontrast der Kamera senken oder weicheres Licht verwenden.',
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

  it('names too low brightness or too much contrast on underexposed shadows', () => {
    expect(mainIssue({ ...fine, shadowsCrushed: true, delta: -0.1 })?.label).toBe(
      'Helligkeit zu niedrig',
    );
    expect(mainIssue({ ...fine, shadowsCrushed: true, contrast: 0.26 })?.label).toBe(
      'Kontrast zu hoch',
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
