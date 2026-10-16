import { describe, expect, it } from 'vitest';

import { homographyFromCorners, project } from './homography';
import type { Corners } from './types';

function expectPoint(actual: { x: number; y: number }, x: number, y: number) {
  expect(actual.x).toBeCloseTo(x, 6);
  expect(actual.y).toBeCloseTo(y, 6);
}

describe('homographyFromCorners', () => {
  it('bildet ein achsparalleles Rechteck affin ab', () => {
    const corners: Corners = [
      { x: 10, y: 20 },
      { x: 110, y: 20 },
      { x: 110, y: 220 },
      { x: 10, y: 220 },
    ];
    const h = homographyFromCorners(corners);
    expect(h[6]).toBe(0);
    expect(h[7]).toBe(0);
    expectPoint(project(h, 0.5, 0.5), 60, 120);
  });

  it('trifft bei perspektivischer Verzerrung alle vier Ecken', () => {
    const corners: Corners = [
      { x: 100, y: 50 },
      { x: 420, y: 80 },
      { x: 380, y: 400 },
      { x: 60, y: 350 },
    ];
    const h = homographyFromCorners(corners);
    expectPoint(project(h, 0, 0), 100, 50);
    expectPoint(project(h, 1, 0), 420, 80);
    expectPoint(project(h, 1, 1), 380, 400);
    expectPoint(project(h, 0, 1), 60, 350);
  });

  it('verschiebt die Mitte bei Perspektive zur fernen (schmalen) Kante', () => {
    const corners: Corners = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 80, y: 100 },
      { x: 20, y: 100 },
    ];
    const centre = project(homographyFromCorners(corners), 0.5, 0.5);
    expect(centre.x).toBeCloseTo(50, 6);
    expect(centre.y).toBeGreaterThan(50);
  });

  it('lehnt Eckpunkte auf einer Linie ab', () => {
    const corners: Corners = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 20 },
      { x: 5, y: 5 },
    ];
    expect(() => homographyFromCorners(corners)).toThrow('auf einer Linie');
  });
});
