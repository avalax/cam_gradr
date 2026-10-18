import { describe, expect, it } from 'vitest';

import type { ExposureResult } from '../chart/exposure';

import { detailRows, fieldHint, fieldPosition, mainIssue, okBox } from './measure-field';

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
  it('liegt bei Sollwerten in der Mitte', () => {
    expect(fieldPosition({ ...exposure, delta: 0 })).toEqual({ left: 50, top: 50 });
  });

  it('wandert bei zu hoher Helligkeit nach oben und bei zu hohem Kontrast nach rechts', () => {
    const high = fieldPosition({ ...exposure, delta: 0.15, contrast: 0.125 });
    expect(high.top).toBeCloseTo(25, 6);
    expect(high.left).toBeCloseTo(75, 6);
    const low = fieldPosition({ ...exposure, delta: -0.15, contrast: -0.125 });
    expect(low.top).toBeCloseTo(75, 6);
    expect(low.left).toBeCloseTo(25, 6);
  });

  it('bleibt im Feld', () => {
    expect(fieldPosition({ ...exposure, delta: 5, contrast: 5 })).toEqual({ left: 100, top: 0 });
    expect(fieldPosition({ ...exposure, delta: -5, contrast: -5 })).toEqual({ left: 0, top: 100 });
  });
});

describe('okBox', () => {
  it('liegt in der Mitte und entspricht den erlaubten Abweichungen', () => {
    const box = okBox(0.06, 0.05);
    expect(box.left).toBeCloseTo(40, 6);
    expect(box.top).toBeCloseTo(40, 6);
    expect(box.width).toBeCloseTo(20, 6);
    expect(box.height).toBeCloseTo(20, 6);
  });

  it('nutzt standardmäßig die Toleranzen der Bewertung und bleibt im Feld', () => {
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

  it('zeigt positive Abweichung mit Plus und geclippte Lichter', () => {
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

  it('bestätigt den Normalbereich', () => {
    expect(fieldHint(fine)).toBe('Helligkeit und Kontrast befinden sich im Normalbereich.');
  });

  it('verlangt bei zu niedriger oder zu hoher Helligkeit zuerst die Helligkeit', () => {
    expect(fieldHint({ ...fine, delta: -0.2, contrast: 0.1 })).toBe(
      'Helligkeit erhöhen (Beleuchtung verstärken oder Belichtung der Kamera erhöhen). Danach den Kontrast prüfen.',
    );
    expect(fieldHint({ ...fine, delta: 0.2, contrast: -0.1 })).toBe(
      'Helligkeit verringern (Beleuchtung abschwächen oder Belichtung der Kamera verringern). Danach den Kontrast prüfen.',
    );
  });

  it('verlangt bei unterbelichteten Schatten zuerst mehr Helligkeit, auch bei zu wenig Kontrast', () => {
    expect(fieldHint({ ...fine, shadowsCrushed: true, delta: -0.1, contrast: -0.1 })).toContain(
      'Schatten unterbelichtet: erst die Helligkeit erhöhen',
    );
  });

  it('unterscheidet bei überbelichteten Lichtern zwischen Helligkeit und Kontrast', () => {
    expect(fieldHint({ ...fine, highlightsClipped: true, delta: 0.1 })).toContain(
      'Helligkeit verringern',
    );
    expect(fieldHint({ ...fine, highlightsClipped: true, delta: 0 })).toBe(
      'Lichter überbelichtet: Kontrast verringern (Kontrast der Kamera senken oder weicheres Licht verwenden).',
    );
  });

  it('verlangt bei unter- und überbelichteten Enden weniger Kontrast und gleichmäßigeres Licht', () => {
    const hint = fieldHint({ ...fine, shadowsCrushed: true, highlightsClipped: true });
    expect(hint).toContain('Kontrast verringern');
    expect(hint).toContain('gleichmäßiger');
  });

  it('nennt den Kontrast erst, wenn die Helligkeit passt', () => {
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

  it('meldet nichts ohne Messung und im Normalbereich', () => {
    expect(mainIssue(null)).toBeNull();
    expect(mainIssue(fine)).toBeNull();
  });

  it('legt die Meldung an den Rand, zu dem die Helligkeit abweicht', () => {
    expect(mainIssue({ ...fine, delta: -0.2 })).toMatchObject({
      edge: 'bottom',
      label: 'Helligkeit zu niedrig',
    });
    expect(mainIssue({ ...fine, delta: 0.2 })).toMatchObject({
      edge: 'top',
      label: 'Helligkeit zu hoch',
    });
  });

  it('nennt bei unterbelichteten Schatten zu niedrige Helligkeit', () => {
    expect(mainIssue({ ...fine, shadowsCrushed: true, contrast: -0.1 })).toMatchObject({
      edge: 'bottom',
      label: 'Helligkeit zu niedrig',
    });
  });

  it('nennt bei überbelichteten Lichtern je nach Abweichung Helligkeit oder Kontrast', () => {
    expect(mainIssue({ ...fine, highlightsClipped: true, delta: 0.1 })?.label).toBe(
      'Helligkeit zu hoch',
    );
    expect(mainIssue({ ...fine, highlightsClipped: true })?.label).toBe('Kontrast zu hoch');
  });

  it('nennt den Kontrast erst, wenn die Helligkeit passt', () => {
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
