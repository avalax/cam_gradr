import { describe, expect, it } from 'vitest';

import { createPchip } from './pchip';

describe('createPchip', () => {
  it('runs exactly through the control points', () => {
    const curve = { xs: [0, 0.2, 0.5, 1], ys: [0, 0.1, 0.45, 1] };
    const f = createPchip(curve);
    for (const [k, x] of curve.xs.entries()) {
      expect(f(x)).toBeCloseTo(curve.ys[k] ?? NaN, 12);
    }
  });

  it('stays monotone for monotone data (no overshoot)', () => {
    const f = createPchip({ xs: [0, 0.1, 0.2, 0.9, 1], ys: [0, 0.02, 0.5, 0.52, 1] });
    let previous = f(0);
    for (let x = 0.001; x <= 1; x += 0.001) {
      const value = f(x);
      expect(value).toBeGreaterThanOrEqual(previous - 1e-12);
      previous = value;
    }
  });

  it('reproduces a straight line exactly', () => {
    const f = createPchip({ xs: [0, 0.3, 0.6, 1], ys: [0, 0.3, 0.6, 1] });
    for (const x of [0.05, 0.2, 0.45, 0.8, 0.99]) {
      expect(f(x)).toBeCloseTo(x, 12);
    }
  });

  it('works with just two points (linear)', () => {
    const f = createPchip({ xs: [0, 1], ys: [0, 2] });
    expect(f(0.25)).toBeCloseTo(0.5, 12);
  });

  it('continues linearly with the edge slope outside', () => {
    const f = createPchip({ xs: [0, 1], ys: [0, 2] });
    expect(f(-0.5)).toBeCloseTo(-1, 12);
    expect(f(1.5)).toBeCloseTo(3, 12);
  });

  it('sets the edge slope to 0 if it would change sign', () => {
    const f = createPchip({ xs: [0, 1, 2], ys: [0, 1, 11] });
    expect(f(-1)).toBeCloseTo(0, 12);
  });

  it('limits the edge slope to three times on a slope change', () => {
    const f = createPchip({ xs: [0, 1, 2], ys: [0, 1, -9] });
    expect(f(-1)).toBeCloseTo(-3, 12);
  });

  it('has horizontal tangents at kinks with a sign change', () => {
    const f = createPchip({ xs: [0, 1, 2], ys: [0, 1, 0] });
    expect(f(0.9)).toBeLessThanOrEqual(1);
    expect(f(1.1)).toBeLessThanOrEqual(1);
    expect(f(1)).toBeCloseTo(1, 12);
  });

  it('rejects invalid inputs', () => {
    expect(() => createPchip({ xs: [0], ys: [0] })).toThrow('at least two');
    expect(() => createPchip({ xs: [0, 1], ys: [0] })).toThrow('at least two');
    expect(() => createPchip({ xs: [0, 0], ys: [0, 1] })).toThrow('strictly increasing');
    expect(() => createPchip({ xs: [0, 1, 0.5], ys: [0, 1, 1] })).toThrow('strictly increasing');
  });
});
