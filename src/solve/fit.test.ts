import { describe, expect, it } from 'vitest';

import { NEUTRAL_IDS } from '../chart/layouts';
import type { Rgb } from '../chart/types';
import { labToLinearSrgb, srgbToLab } from '../color/lab';
import { linearToSrgb, srgbToLinear } from '../color/srgb';
import type { Vec3 } from '../color/lab';
import type { ReferenceSet } from '../reference/reference';
import { setLocale } from '../lang';
import { cameraCode } from '../test-support/synthetic-camera';
import bundledJson from '../data/reference/spyder-checkr-48.reference.json';
import { dummyIds, dummyLab } from '../test-support/dummy-reference';

import { applyColorModel, fitColorModel } from './fit';

function referenceSet(ids = dummyIds()): ReferenceSet {
  return {
    name: 'Test',
    patches: Object.fromEntries(ids.map((id) => [id, dummyLab(id)])),
  };
}

// The bundled reference set as a ReferenceSet.
function bundledReference(): ReferenceSet {
  return {
    name: bundledJson.name,
    patches: Object.fromEntries(
      bundledJson.patches.map((patch) => [patch.id, patch.lab as unknown as Vec3]),
    ),
  };
}

// The same color at half the light (one stop darker).
function halve([r, g, b]: Rgb): Rgb {
  return [r, g, b].map((value) => linearToSrgb(srgbToLinear(value) / 2)) as unknown as Rgb;
}

function measure(reference: ReferenceSet): Record<string, Rgb> {
  return Object.fromEntries(
    Object.entries(reference.patches).map(([id, lab]) => [id, cameraCode(lab)]),
  );
}

describe('test data', () => {
  it('lie within the sRGB color space (otherwise no correction would be possible)', () => {
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

  it('reports the error separately for neutral patches and color patches', () => {
    const { neutral, color } = result.report;
    expect(neutral?.count).toBe(NEUTRAL_IDS.size);
    expect(color?.count).toBe(dummyIds().length - NEUTRAL_IDS.size);
    expect(neutral?.meanAfter).toBeLessThan(neutral?.meanBefore ?? 0);
    expect(color?.meanAfter).toBeLessThan(color?.meanBefore ?? 0);
  });

  it('compensates compressed highlights without tinting the bright neutral patches', () => {
    // Neutral ladder of a real webcam in dim light: from 2E the highlights are compressed
    // (2E, 2D and 1D give almost the same value although their brightness is far apart).
    const ladder: Record<string, Rgb> = {
      '6E': [0.025, 0.022, 0.035],
      '6D': [0.108, 0.113, 0.138],
      '5E': [0.183, 0.183, 0.209],
      '5D': [0.233, 0.245, 0.274],
      '4E': [0.334, 0.332, 0.355],
      '4D': [0.388, 0.402, 0.423],
      '3E': [0.481, 0.479, 0.499],
      '3D': [0.518, 0.512, 0.54],
      '2E': [0.577, 0.573, 0.582],
      '2D': [0.585, 0.581, 0.607],
      '1D': [0.579, 0.572, 0.581],
      '1E': [0.641, 0.634, 0.625],
    };
    const real = bundledReference();
    const compressed = fitColorModel({
      measurements: { ...measure(real), ...ladder },
      reference: real,
      neutralIds: NEUTRAL_IDS,
    });
    const brightest = compressed.report.patches.find((patch) => patch.id === '2E');
    expect(brightest?.after).toBeLessThan(8);
    expect(compressed.report.indistinct.toSorted((a, b) => a.localeCompare(b))).toEqual([
      '1D',
      '2D',
      '2E',
    ]);
    expect(compressed.report.neutral?.meanAfter).toBeLessThan(3.5);
  });

  it('reports no indistinguishable neutral patches when the camera measures cleanly', () => {
    expect(result.report.indistinct).toEqual([]);
  });

  it('leaves a group empty when there are no such patches', () => {
    const onlyNeutral = referenceSet([...NEUTRAL_IDS]);
    const gray = fitColorModel({
      measurements: measure(onlyNeutral),
      reference: onlyNeutral,
      neutralIds: NEUTRAL_IDS,
    });
    expect(gray.report.color).toBeNull();
    expect(gray.report.neutral?.count).toBe(NEUTRAL_IDS.size);
  });

  it('largely undoes the known distortion of the artificial webcam', () => {
    expect(result.report.meanBefore).toBeGreaterThan(4);
    expect(result.report.meanAfter).toBeLessThan(1);
    expect(result.report.maxAfter).toBeLessThan(2.5);
    expect(result.report.meanAfter).toBeLessThan(result.report.meanBefore / 4);
  });

  it('reports every patch with its error before and after', () => {
    expect(result.report.patches).toHaveLength(48);
    const patch = result.report.patches.find((entry) => entry.id === '3A');
    expect(patch?.before).toBeGreaterThan(0);
    expect(patch?.after).toBeLessThan(patch?.before ?? 0);
    expect(result.report.maxBefore).toBe(Math.max(...result.report.patches.map((p) => p.before)));
  });

  it('keeps the shadows and highlights of a contrasty camera: no lifted black, no early clipping', () => {
    // Neutral ladder of a camera with a strong S curve (shadows crushed, highlights compressed).
    const brightest: Rgb = [0.919, 0.888, 0.86];
    const ladder: Record<string, Rgb> = {
      '1D': [0.89, 0.847, 0.812],
      '2D': [0.875, 0.832, 0.807],
      '3D': [0.806, 0.764, 0.737],
      '4D': [0.673, 0.633, 0.612],
      '5D': [0.451, 0.411, 0.395],
      '6D': [0.246, 0.221, 0.208],
      '1E': brightest,
      '2E': [0.876, 0.827, 0.801],
      '3E': [0.791, 0.743, 0.718],
      '4E': [0.624, 0.576, 0.552],
      '5E': [0.394, 0.36, 0.339],
      '6E': [0.096, 0.078, 0.067],
    };
    const contrasty = fitColorModel({
      measurements: { ...measure(reference), ...ladder },
      reference,
      neutralIds: NEUTRAL_IDS,
    });
    // Shadows are brightened by at most the gain limit (in linear light), not several times over.
    for (const code of [0.05, 0.1, 0.2]) {
      const [, green] = applyColorModel(contrasty.model, [code, code, code]);
      expect(srgbToLinear(green) / srgbToLinear(code)).toBeLessThan(1.7);
    }
    // The brightest patch stays below white, so the highlights above it keep their detail.
    const [red, green, blue] = applyColorModel(contrasty.model, brightest);
    expect(Math.max(red, green, blue)).toBeLessThan(0.999);
  });

  it('desaturates colors outside the sRGB cube instead of clipping single channels', () => {
    const identity = { xs: [0, 1], ys: [0, 1] };
    // A strongly mixing matrix: a saturated blue gets a negative red value.
    const model = {
      curves: [identity, identity, identity],
      matrix: [
        [1.4, 0.3, -0.7],
        [0, 1, 0],
        [0, 0, 1],
      ],
    } as const;
    const input: [number, number, number] = [
      linearToSrgb(0.1),
      linearToSrgb(0.3),
      linearToSrgb(0.9),
    ];
    const [r, g, b] = applyColorModel(model, input).map((value) => srgbToLinear(value));
    expect(r).toBeCloseTo(0, 6);
    // Same luminance as the mixed color, instead of the clipped (0, 0.3, 0.9).
    expect(0.2126 * Number(r) + 0.7152 * Number(g) + 0.0722 * Number(b)).toBeCloseTo(0.1946, 3);
    expect(Number(b)).toBeLessThan(0.5);
  });

  it('keeps grays gray and white white', () => {
    for (const gray of [0.05, 0.2, 0.4, 0.6, 0.8, 1]) {
      const camera = cameraCode(
        // neutral Lab value for the desired lightness
        srgbToLab([gray, gray, gray]),
      );
      const [r, g, b] = applyColorModel(result.model, camera);
      expect(Math.abs(r - g)).toBeLessThan(0.02);
      expect(Math.abs(g - b)).toBeLessThan(0.02);
      expect(g).toBeCloseTo(gray, 1);
    }
  });

  it('keeps matrix rows at sum 1 and stays within the value range', () => {
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

  it('also works with only some of the patches', () => {
    const ids = dummyIds().filter((id, index) => NEUTRAL_IDS.has(id) || index % 3 === 0);
    const partial = referenceSet(ids);
    const fit = fitColorModel({
      measurements: measure(partial),
      reference: partial,
      neutralIds: NEUTRAL_IDS,
    });
    expect(fit.report.meanAfter).toBeLessThan(fit.report.meanBefore);
  });

  it('ignores patches without a measurement', () => {
    const fewer = { ...measurements };
    delete fewer['1A'];
    const fit = fitColorModel({ measurements: fewer, reference, neutralIds: NEUTRAL_IDS });
    expect(fit.report.patches.some((entry) => entry.id === '1A')).toBe(false);
  });

  it('handles curves with duplicate measurements and anchors', () => {
    // White and a lighter step measure exactly the same (clipped), the black is above 0.
    const clipped = { ...measurements, '1E': [1, 1, 1] as Rgb, '1D': [1, 1, 1] as Rgb };
    expect(() =>
      fitColorModel({ measurements: clipped, reference, neutralIds: NEUTRAL_IDS }),
    ).not.toThrow();
  });

  it('uses a measured black at 0 without an additional anchor point', () => {
    const blackIsZero = { ...measurements, '6E': [0, 0, 0] as Rgb };
    const fit = fitColorModel({ measurements: blackIsZero, reference, neutralIds: NEUTRAL_IDS });
    for (const curve of fit.model.curves) {
      expect(curve.xs[0]).toBe(0);
      expect(curve.xs.filter((x) => x === 0)).toHaveLength(1);
    }
  });

  it('keeps the exposure of the shot instead of brightening it to the reference', () => {
    // The camera is one stop too dark; the correction must not turn the image brighter.
    const dark = Object.fromEntries(
      Object.entries(measurements).map(([id, code]) => [id, halve(code)]),
    );
    const fit = fitColorModel({ measurements: dark, reference, neutralIds: NEUTRAL_IDS });
    const gray = halve(cameraCode(dummyLab('3D')));
    const corrected = applyColorModel(fit.model, gray);
    expect(Math.abs(corrected[1] - gray[1])).toBeLessThan(0.05);
    // The deviation is measured at the exposure of the shot, so the dark shot is not punished.
    expect(fit.report.meanBefore).toBeLessThan(10);
  });

  it('builds smooth tone curves that never raise a value by more than the gain limit', () => {
    for (const curve of result.model.curves) {
      expect(curve.xs.length).toBeGreaterThan(20);
      for (let index = 1; index < curve.xs.length; index++) {
        expect(Number(curve.ys[index])).toBeGreaterThanOrEqual(Number(curve.ys[index - 1]));
        expect(Number(curve.ys[index])).toBeLessThanOrEqual(4 * Number(curve.xs[index]) + 1e-9);
      }
    }
  });

  it('does not amplify a crushed black without limit', () => {
    // The camera shows the three darkest steps almost black (clipped shadows).
    const crushed = { ...measurements };
    for (const id of ['6E', '5E', '4E']) {
      crushed[id] = [0.002, 0.002, 0.002];
    }
    const fit = fitColorModel({ measurements: crushed, reference, neutralIds: NEUTRAL_IDS });
    for (const curve of fit.model.curves) {
      for (const [index, x] of curve.xs.entries()) {
        expect(Number(curve.ys[index])).toBeLessThanOrEqual(4 * x + 1e-9);
      }
    }
  });

  it('survives a completely black camera image', () => {
    const black = Object.fromEntries(Object.keys(measurements).map((id) => [id, [0, 0, 0] as Rgb]));
    const fit = fitColorModel({ measurements: black, reference, neutralIds: NEUTRAL_IDS });
    for (const curve of fit.model.curves) {
      expect(curve.ys.every((value) => Number.isFinite(value))).toBe(true);
    }
  });

  it('applies no exposure gain when no neutral patch lies in the mid tones', () => {
    const bright: ReferenceSet = {
      name: 'Bright',
      patches: {
        ...Object.fromEntries(
          ['3A', '4A', '5A', '6A', '1B', '2B', '3B', '4B'].map((id) => [id, dummyLab(id)]),
        ),
        '1D': [99, 0, 0],
        '2D': [98, 0, 0],
        '1E': [97, 0, 0],
        '2E': [96, 0, 0],
      },
    };
    const fit = fitColorModel({
      measurements: measure(bright),
      reference: bright,
      neutralIds: NEUTRAL_IDS,
    });
    expect(fit.report.patches).toHaveLength(12);
  });

  it('keeps the tone curve of the camera without the tone correction', () => {
    // A camera that is darker and has a different gamma: only a factor per channel is applied.
    const odd = Object.fromEntries(
      Object.entries(measurements).map(([id, code]) => [id, halve(code)]),
    );
    const plain = fitColorModel({
      measurements: odd,
      reference,
      neutralIds: NEUTRAL_IDS,
      tone: false,
    });
    for (const curve of plain.model.curves) {
      expect(curve.xs).toHaveLength(3);
      expect(curve.ys[0]).toBe(0);
    }
    // White stays white, so blown-out highlights do not get a color.
    for (const value of applyColorModel(plain.model, [1, 1, 1])) {
      expect(value).toBeCloseTo(1, 3);
    }
    // Below the knee the curve is a straight line, so dark and mid tones keep their ratio.
    const [red] = plain.model.curves;
    const dark = applyColorModel(plain.model, [0.2, 0.2, 0.2]);
    const mid = applyColorModel(plain.model, [0.4, 0.4, 0.4]);
    expect(red.ys[1]).toBeGreaterThan(0);
    expect(mid[1]).toBeGreaterThan(dark[1]);
    expect(plain.report.meanAfter).toBeLessThan(plain.report.meanBefore);
  });

  it('limits the white balance factor without the tone correction', () => {
    const black = Object.fromEntries(
      Object.keys(measurements).map((id) => [id, [0.001, 0.001, 0.001]]),
    );
    const plain = fitColorModel({
      measurements: black as unknown as Record<string, Rgb>,
      reference,
      neutralIds: NEUTRAL_IDS,
      tone: false,
    });
    for (const curve of plain.model.curves) {
      expect(Number(curve.ys[1])).toBeLessThanOrEqual(4);
      expect(Number(curve.ys[1])).toBeGreaterThanOrEqual(0.25);
    }
  });

  it('throws with too few patches or neutral patches', () => {
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

  it('stays close to the identity matrix for indistinguishable patches', () => {
    const flat: Record<string, Rgb> = Object.fromEntries(
      dummyIds().map((id) => [id, [0.5, 0.5, 0.5]]),
    );
    const fit = fitColorModel({ measurements: flat, reference, neutralIds: NEUTRAL_IDS });
    for (const [index, row] of fit.model.matrix.entries()) {
      expect(row[index]).toBeGreaterThan(0.5);
    }
  });
});

describe('fitColorModel (English)', () => {
  it('reports too few measurements in English', () => {
    setLocale('en');
    const few = referenceSet(['1D', '2D', '3D']);
    expect(() =>
      fitColorModel({ measurements: measure(few), reference: few, neutralIds: NEUTRAL_IDS }),
    ).toThrow(/^Too few measurements: at least \d+ patches, \d+ of them neutral$/);
  });
});
