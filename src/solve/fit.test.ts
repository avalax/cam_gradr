import { describe, expect, it } from 'vitest';

import { NEUTRAL_IDS } from '../chart/layouts';
import type { Rgb } from '../chart/types';
import { labToLinearSrgb, srgbToLab } from '../color/lab';
import type { ReferenceSet } from '../reference/reference';
import { cameraCode } from '../test-support/synthetic-camera';
import { dummyIds, dummyLab } from '../test-support/dummy-reference';

import { applyColorModel, fitColorModel } from './fit';

function referenceSet(ids = dummyIds()): ReferenceSet {
  return {
    name: 'Test',
    patches: Object.fromEntries(ids.map((id) => [id, dummyLab(id)])),
  };
}

function measure(reference: ReferenceSet): Record<string, Rgb> {
  return Object.fromEntries(
    Object.entries(reference.patches).map(([id, lab]) => [id, cameraCode(lab)]),
  );
}

describe('Testdaten', () => {
  it('liegen innerhalb des sRGB-Farbraums (sonst wäre keine Korrektur möglich)', () => {
    for (const id of dummyIds()) {
      const linear = labToLinearSrgb(dummyLab(id));
      for (const value of linear) {
        expect(value).toBeGreaterThanOrEqual(-0.001);
        expect(value).toBeLessThanOrEqual(1.001);
      }
    }
  });
});

describe('fitColorModel', () => {
  const reference = referenceSet();
  const measurements = measure(reference);
  const result = fitColorModel({ measurements, reference, neutralIds: NEUTRAL_IDS });

  it('weist den Fehler getrennt für Neutralfelder und Farbfelder aus', () => {
    const { neutral, color } = result.report;
    expect(neutral?.count).toBe(NEUTRAL_IDS.size);
    expect(color?.count).toBe(dummyIds().length - NEUTRAL_IDS.size);
    expect(neutral?.meanAfter).toBeLessThan(neutral?.meanBefore ?? 0);
    expect(color?.meanAfter).toBeLessThan(color?.meanBefore ?? 0);
  });

  it('lässt eine Gruppe leer, wenn es keine solchen Felder gibt', () => {
    const onlyNeutral = referenceSet([...NEUTRAL_IDS]);
    const gray = fitColorModel({
      measurements: measure(onlyNeutral),
      reference: onlyNeutral,
      neutralIds: NEUTRAL_IDS,
    });
    expect(gray.report.color).toBeNull();
    expect(gray.report.neutral?.count).toBe(NEUTRAL_IDS.size);
  });

  it('macht die bekannte Verfälschung der künstlichen Webcam weitgehend rückgängig', () => {
    expect(result.report.meanBefore).toBeGreaterThan(4);
    expect(result.report.meanAfter).toBeLessThan(1);
    expect(result.report.maxAfter).toBeLessThan(2.5);
    expect(result.report.meanAfter).toBeLessThan(result.report.meanBefore / 4);
  });

  it('berichtet jedes Feld mit Fehler vorher und nachher', () => {
    expect(result.report.patches).toHaveLength(48);
    const patch = result.report.patches.find((entry) => entry.id === '3A');
    expect(patch?.before).toBeGreaterThan(0);
    expect(patch?.after).toBeLessThan(patch?.before ?? 0);
    expect(result.report.maxBefore).toBe(Math.max(...result.report.patches.map((p) => p.before)));
  });

  it('lässt Grautöne grau und Weiß bei Weiß', () => {
    for (const gray of [0.05, 0.2, 0.4, 0.6, 0.8, 1]) {
      const camera = cameraCode(
        // neutraler Lab-Wert zur gewünschten Helligkeit
        srgbToLab([gray, gray, gray]),
      );
      const [r, g, b] = applyColorModel(result.model, camera);
      expect(Math.abs(r - g)).toBeLessThan(0.02);
      expect(Math.abs(g - b)).toBeLessThan(0.02);
      expect(g).toBeCloseTo(gray, 1);
    }
  });

  it('hält Matrixzeilen bei Summe 1 und bleibt im Wertebereich', () => {
    for (const row of result.model.matrix) {
      expect(row[0] + row[1] + row[2]).toBeCloseTo(1, 10);
    }
    for (const input of [0, 0.3, 1] as const) {
      const corrected = applyColorModel(result.model, [input, 1 - input, input]);
      for (const value of corrected) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });

  it('funktioniert auch mit nur einem Teil der Felder', () => {
    const ids = dummyIds().filter((id, index) => NEUTRAL_IDS.has(id) || index % 3 === 0);
    const partial = referenceSet(ids);
    const fit = fitColorModel({
      measurements: measure(partial),
      reference: partial,
      neutralIds: NEUTRAL_IDS,
    });
    expect(fit.report.meanAfter).toBeLessThan(fit.report.meanBefore);
  });

  it('ignoriert Felder ohne Messwert', () => {
    const fewer = { ...measurements };
    delete fewer['1A'];
    const fit = fitColorModel({ measurements: fewer, reference, neutralIds: NEUTRAL_IDS });
    expect(fit.report.patches.some((entry) => entry.id === '1A')).toBe(false);
  });

  it('verarbeitet Kurven mit doppelten Messwerten und Ankern', () => {
    // Weiß und eine hellere Stufe messen exakt gleich (geclippt), das Schwarz liegt über 0.
    const clipped = { ...measurements, '1E': [1, 1, 1] as Rgb, '1D': [1, 1, 1] as Rgb };
    expect(() =>
      fitColorModel({ measurements: clipped, reference, neutralIds: NEUTRAL_IDS }),
    ).not.toThrow();
  });

  it('nutzt ein gemessenes Schwarz bei 0 ohne zusätzlichen Ankerpunkt', () => {
    const blackIsZero = { ...measurements, '6E': [0, 0, 0] as Rgb };
    const fit = fitColorModel({ measurements: blackIsZero, reference, neutralIds: NEUTRAL_IDS });
    for (const curve of fit.model.curves) {
      expect(curve.xs[0]).toBe(0);
      expect(curve.xs.filter((x) => x === 0)).toHaveLength(1);
    }
  });

  it('wirft bei zu wenigen Feldern oder Neutralfeldern', () => {
    const few = referenceSet(['1D', '2D', '3D']);
    expect(() =>
      fitColorModel({ measurements: measure(few), reference: few, neutralIds: NEUTRAL_IDS }),
    ).toThrow('Zu wenige Messwerte');
    const colourOnly = referenceSet(dummyIds().filter((id) => !NEUTRAL_IDS.has(id)));
    expect(() =>
      fitColorModel({
        measurements: measure(colourOnly),
        reference: colourOnly,
        neutralIds: NEUTRAL_IDS,
      }),
    ).toThrow('Zu wenige Messwerte');
  });

  it('bleibt bei ununterscheidbaren Feldern nahe der Einheitsmatrix', () => {
    const flat: Record<string, Rgb> = Object.fromEntries(
      dummyIds().map((id) => [id, [0.5, 0.5, 0.5]]),
    );
    const fit = fitColorModel({ measurements: flat, reference, neutralIds: NEUTRAL_IDS });
    for (const [index, row] of fit.model.matrix.entries()) {
      expect(row[index]).toBeGreaterThan(0.5);
    }
  });
});
