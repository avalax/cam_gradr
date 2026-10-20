import { describe, expect, it } from 'vitest';

import type { ExposureResult } from '../chart/exposure';
import { setLocale } from '../lang';

import {
  detailCaption,
  detailRows,
  fieldHint,
  fieldPosition,
  mainIssue,
  okBox,
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

describe('okBox', () => {
  it('sits in the middle and matches the allowed deviations', () => {
    const box = okBox(0.06, 0.05);
    expect(box.left).toBeCloseTo(40, 6);
    expect(box.top).toBeCloseTo(40, 6);
    expect(box.width).toBeCloseTo(20, 6);
    expect(box.height).toBeCloseTo(20, 6);
  });

  it('uses the rating tolerances by default and stays in the field', () => {
    expect(okBox().width).toBeCloseTo(20, 6);
    expect(okBox(1, 1)).toEqual({ left: 0, top: 0, width: 100, height: 100 });
  });
});

describe('detailRows', () => {
  it('liefert alle Einzelwerte lesbar', () => {
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

  it('nennt fehlende Messung', () => {
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

  it('puts the message at the edge the brightness deviates towards', () => {
    expect(mainIssue({ ...fine, delta: -0.2 })).toMatchObject({
      edge: 'bottom',
      label: 'Helligkeit zu niedrig',
    });
    expect(mainIssue({ ...fine, delta: 0.2 })).toMatchObject({
      edge: 'top',
      label: 'Helligkeit zu hoch',
    });
  });

  it('names too low brightness on underexposed shadows', () => {
    expect(mainIssue({ ...fine, shadowsCrushed: true, contrast: -0.1 })).toMatchObject({
      edge: 'bottom',
      label: 'Helligkeit zu niedrig',
    });
  });

  it('names brightness or contrast on overexposed highlights depending on the deviation', () => {
    expect(mainIssue({ ...fine, highlightsClipped: true, delta: 0.1 })?.label).toBe(
      'Helligkeit zu hoch',
    );
    expect(mainIssue({ ...fine, highlightsClipped: true })?.label).toBe('Kontrast zu hoch');
  });

  it('names the contrast only once the brightness fits', () => {
    expect(mainIssue({ ...fine, contrast: -0.1 })).toMatchObject({
      edge: 'left',
      label: 'Kontrast zu niedrig',
    });
    expect(mainIssue({ ...fine, contrast: 0.1 })).toMatchObject({
      edge: 'right',
      label: 'Kontrast zu hoch',
    });
  });
});

describe('English texts', () => {
  const fine = { ...exposure, shadowsCrushed: false, delta: 0 };

  it('lists the detail rows with English numbers and wording', () => {
    setLocale('en');
    expect(detailCaption()).toBe(
      'Brightness of the gray fields in the image (0% black, 100% white)',
    );
    expect(detailRows({ ...exposure, delta: 0.105, highlightsClipped: true })).toEqual([
      { label: '18% card', value: '46% (target 46%)' },
      { label: '50% card', value: '74% (target 74%)' },
      { label: 'Brightness', value: '+11 points (Tolerance ±6)' },
      { label: 'Contrast', value: '+0 points (Tolerance ±5)' },
      { label: 'Highlights', value: 'overexposed' },
      { label: 'Shadows', value: 'underexposed' },
    ]);
    expect(detailRows(fine)[4]?.value).toBe('ok');
  });

  it('words the next step in English', () => {
    setLocale('en');
    expect(fieldHint(null)).toBe('No measurement yet.');
    expect(fieldHint(fine)).toBe('Brightness and contrast are within the normal range.');
    expect(mainIssue({ ...fine, delta: -0.2 })).toMatchObject({
      edge: 'bottom',
      label: 'Brightness too low',
    });
    expect(mainIssue({ ...fine, delta: 0.2 })?.label).toBe('Brightness too high');
    expect(mainIssue({ ...fine, contrast: -0.1 })?.label).toBe('Contrast too low');
    expect(mainIssue({ ...fine, contrast: 0.1 })?.label).toBe('Contrast too high');
    expect(fieldHint({ ...fine, shadowsCrushed: true })).toContain('Shadows underexposed');
    expect(fieldHint({ ...fine, shadowsCrushed: true, highlightsClipped: true })).toContain(
      'avoid reflections',
    );
    expect(fieldHint({ ...fine, highlightsClipped: true, delta: 0.2 })).toContain(
      'reduce the brightness',
    );
    expect(fieldHint({ ...fine, highlightsClipped: true })).toContain('reduce the contrast');
  });
});
