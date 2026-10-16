import { describe, expect, it } from 'vitest';

import type { ExposureResult } from '../chart/exposure';

import { detailRows, okBand, scaleGradient, scalePosition, summary } from './brightness-scale';

const exposure: ExposureResult = {
  verdict: 'ok',
  highlightsClipped: false,
  shadowsCrushed: true,
  level18: 0.46,
  level50: 0.74,
  delta: -0.03,
};

describe('scalePosition', () => {
  it('liegt bei Abweichung 0 in der Mitte', () => {
    expect(scalePosition(0)).toBe(50);
  });

  it('wandert bei zu hell nach oben und bei zu dunkel nach unten', () => {
    expect(scalePosition(0.15)).toBeCloseTo(25, 6);
    expect(scalePosition(-0.15)).toBeCloseTo(75, 6);
  });

  it('bleibt auf der Skala', () => {
    expect(scalePosition(5)).toBe(0);
    expect(scalePosition(-5)).toBe(100);
  });
});

describe('okBand', () => {
  it('entspricht der erlaubten Abweichung', () => {
    expect(okBand(0.06)).toEqual({ from: 40, to: 60 });
  });

  it('nutzt standardmäßig die Toleranz der Bewertung und bleibt auf der Skala', () => {
    expect(okBand()).toEqual({ from: 40, to: 60 });
    expect(okBand(1)).toEqual({ from: 0, to: 100 });
  });
});

describe('scaleGradient', () => {
  it('läuft in Graustufen von hell oben nach dunkel unten', () => {
    const gradient = scaleGradient();
    expect(gradient).toContain('to bottom');
    expect(gradient.indexOf('#f5f5f5')).toBeLessThan(gradient.indexOf('#737373'));
    expect(gradient.indexOf('#737373')).toBeLessThan(gradient.indexOf('#171717'));
  });
});

describe('detailRows', () => {
  it('liefert alle Einzelwerte lesbar', () => {
    expect(detailRows(exposure)).toEqual([
      { label: '18 %-Feld', value: '46 %' },
      { label: '50 %-Feld', value: '74 %' },
      { label: 'Abweichung', value: '−3 Punkte' },
      { label: 'Lichter', value: 'ok' },
      { label: 'Schatten', value: 'abgesoffen' },
    ]);
  });

  it('zeigt positive Abweichung mit Plus und geclippte Lichter', () => {
    const rows = detailRows({ ...exposure, delta: 0.1, highlightsClipped: true });
    expect(rows[2]?.value).toBe('+10 Punkte');
    expect(rows[3]?.value).toBe('geclippt');
  });
});

describe('summary', () => {
  it('nennt fehlende Messung oder das Urteil', () => {
    expect(summary(null)).toBe('Noch keine Messung.');
    expect(summary(exposure)).toContain('Raumhelligkeit passt');
  });
});
