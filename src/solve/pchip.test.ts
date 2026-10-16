import { describe, expect, it } from 'vitest';

import { createPchip } from './pchip';

describe('createPchip', () => {
  it('läuft exakt durch die Stützpunkte', () => {
    const curve = { xs: [0, 0.2, 0.5, 1], ys: [0, 0.1, 0.45, 1] };
    const f = createPchip(curve);
    for (const [k, x] of curve.xs.entries()) {
      expect(f(x)).toBeCloseTo(curve.ys[k] ?? NaN, 12);
    }
  });

  it('bleibt bei monotonen Daten monoton (kein Überschwingen)', () => {
    const f = createPchip({ xs: [0, 0.1, 0.2, 0.9, 1], ys: [0, 0.02, 0.5, 0.52, 1] });
    let previous = f(0);
    for (let x = 0.001; x <= 1; x += 0.001) {
      const value = f(x);
      expect(value).toBeGreaterThanOrEqual(previous - 1e-12);
      previous = value;
    }
  });

  it('bildet eine Gerade genau ab', () => {
    const f = createPchip({ xs: [0, 0.3, 0.6, 1], ys: [0, 0.3, 0.6, 1] });
    for (const x of [0.05, 0.2, 0.45, 0.8, 0.99]) {
      expect(f(x)).toBeCloseTo(x, 12);
    }
  });

  it('funktioniert mit nur zwei Punkten (linear)', () => {
    const f = createPchip({ xs: [0, 1], ys: [0, 2] });
    expect(f(0.25)).toBeCloseTo(0.5, 12);
  });

  it('setzt außerhalb linear mit der Randsteigung fort', () => {
    const f = createPchip({ xs: [0, 1], ys: [0, 2] });
    expect(f(-0.5)).toBeCloseTo(-1, 12);
    expect(f(1.5)).toBeCloseTo(3, 12);
  });

  it('setzt die Randsteigung auf 0, wenn sie das Vorzeichen wechseln würde', () => {
    const f = createPchip({ xs: [0, 1, 2], ys: [0, 1, 11] });
    expect(f(-1)).toBeCloseTo(0, 12);
  });

  it('begrenzt die Randsteigung bei Steigungswechsel auf das Dreifache', () => {
    const f = createPchip({ xs: [0, 1, 2], ys: [0, 1, -9] });
    expect(f(-1)).toBeCloseTo(-3, 12);
  });

  it('hat an Knicken mit Vorzeichenwechsel waagerechte Tangenten', () => {
    const f = createPchip({ xs: [0, 1, 2], ys: [0, 1, 0] });
    expect(f(0.9)).toBeLessThanOrEqual(1);
    expect(f(1.1)).toBeLessThanOrEqual(1);
    expect(f(1)).toBeCloseTo(1, 12);
  });

  it('lehnt ungültige Eingaben ab', () => {
    expect(() => createPchip({ xs: [0], ys: [0] })).toThrow('mindestens zwei');
    expect(() => createPchip({ xs: [0, 1], ys: [0] })).toThrow('mindestens zwei');
    expect(() => createPchip({ xs: [0, 0], ys: [0, 1] })).toThrow('streng');
    expect(() => createPchip({ xs: [0, 1, 0.5], ys: [0, 1, 1] })).toThrow('streng');
  });
});
