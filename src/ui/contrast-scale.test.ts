import { describe, expect, it } from 'vitest';

import type { ExposureResult } from '../chart/exposure';

import {
  contrastBand,
  contrastGradient,
  contrastPosition,
  contrastRows,
  contrastSummary,
} from './contrast-scale';

const exposure: ExposureResult = {
  verdict: 'ok',
  highlightsClipped: false,
  shadowsCrushed: false,
  level18: 0.4,
  level50: 0.8,
  delta: 0,
  contrast: 0.12,
};

describe('contrastPosition', () => {
  it('liegt bei Abweichung 0 in der Mitte', () => {
    expect(contrastPosition(0)).toBe(50);
  });

  it('wandert bei zu viel Kontrast nach oben und bei zu wenig nach unten', () => {
    expect(contrastPosition(0.1)).toBeCloseTo(25, 6);
    expect(contrastPosition(-0.1)).toBeCloseTo(75, 6);
  });

  it('bleibt auf der Skala', () => {
    expect(contrastPosition(5)).toBe(0);
    expect(contrastPosition(-5)).toBe(100);
  });
});

describe('contrastBand', () => {
  it('entspricht der erlaubten Abweichung und bleibt auf der Skala', () => {
    expect(contrastBand(0.05)).toEqual({ from: 37.5, to: 62.5 });
    expect(contrastBand()).toEqual({ from: 37.5, to: 62.5 });
    expect(contrastBand(1)).toEqual({ from: 0, to: 100 });
  });
});

describe('contrastGradient', () => {
  it('geht von scharfer Trennung oben zu einheitlichem Grau unten', () => {
    const gradient = contrastGradient();
    expect(gradient).toContain('to bottom');
    expect(gradient).toContain('#171717 50%, #f5f5f5 50%');
  });
});

describe('contrastRows und contrastSummary', () => {
  it('zeigt Felder, Abstand und Abweichung', () => {
    expect(contrastRows(exposure)).toEqual([
      { label: '18 %-Feld', value: '40 %' },
      { label: '50 %-Feld', value: '80 %' },
      { label: 'Abstand', value: '40 %' },
      { label: 'Abweichung', value: '+12 Punkte' },
    ]);
    expect(contrastRows({ ...exposure, contrast: -0.07 }).at(-1)?.value).toBe('−7 Punkte');
  });

  it('fasst ohne Messung und mit Messung zusammen', () => {
    expect(contrastSummary(null)).toBe('Noch keine Messung.');
    expect(contrastSummary(exposure)).toContain('verringert werden');
  });
});
