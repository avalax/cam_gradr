import { describe, expect, it } from 'vitest';

import { linearToSrgb, srgbToLinear } from './srgb';

describe('sRGB-Übertragungsfunktion', () => {
  it('behandelt die Eckpunkte', () => {
    expect(srgbToLinear(0)).toBe(0);
    expect(srgbToLinear(1)).toBeCloseTo(1, 10);
    expect(linearToSrgb(0)).toBe(0);
    expect(linearToSrgb(1)).toBeCloseTo(1, 10);
  });

  it('nutzt unterhalb der Knickstelle den linearen Ast', () => {
    expect(srgbToLinear(0.04)).toBeCloseTo(0.04 / 12.92, 12);
    expect(linearToSrgb(0.003)).toBeCloseTo(0.003 * 12.92, 12);
  });

  it('ist umkehrbar', () => {
    for (const v of [0.01, 0.1, 0.18, 0.5, 0.73, 0.99]) {
      expect(linearToSrgb(srgbToLinear(v))).toBeCloseTo(v, 10);
    }
  });

  it('liefert bekannte Referenzwerte', () => {
    expect(srgbToLinear(0.5)).toBeCloseTo(0.214_041, 5);
  });
});
