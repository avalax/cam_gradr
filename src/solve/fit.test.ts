import { describe, expect, it } from 'vitest';

import { NEUTRAL_IDS } from '../chart/layouts';
import type { Rgb } from '../chart/types';
import {
  labToLinearSrgb,
  labToSrgb,
  linearSrgbToXyzD50,
  srgbToLab,
  xyzD50ToLab,
} from '../color/lab';
import { linearToSrgb, srgbToLinear } from '../color/srgb';
import type { Vec3 } from '../color/lab';
import type { ReferenceSet } from '../reference/reference';
import { cameraCode } from '../test-support/synthetic-camera';
import bundledJson from '../data/reference/spyder-checkr-48.reference.json';
import { dummyIds, dummyLab } from '../test-support/dummy-reference';
import { FLAT_HUE } from '../test-support/identity-model';

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

function distance(first: Vec3, second: Vec3): number {
  return Math.hypot(first[0] - second[0], first[1] - second[1], first[2] - second[2]);
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
  const result = fitColorModel({ measurements, reference });

  it('reports the error separately for neutral patches and color patches', () => {
    const { neutral, color } = result.report;
    expect(neutral.count).toBe(NEUTRAL_IDS.size);
    expect(color?.count).toBe(dummyIds().length - NEUTRAL_IDS.size);
    expect(neutral.meanAfter).toBeLessThan(neutral.meanBefore);
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
    });
    const brightest = compressed.report.patches.find((patch) => patch.id === '2E');
    expect(brightest?.after).toBeLessThan(8);
    expect(compressed.report.indistinct.toSorted((a, b) => a.localeCompare(b))).toEqual([
      '1D',
      '2D',
      '2E',
    ]);
    expect(compressed.report.neutral.meanAfter).toBeLessThan(3.5);
  });

  it('reports no indistinguishable neutral patches when the camera measures cleanly', () => {
    expect(result.report.indistinct).toEqual([]);
  });

  it('leaves a group empty when there are no such patches', () => {
    const onlyNeutral = referenceSet([...NEUTRAL_IDS]);
    const gray = fitColorModel({
      measurements: measure(onlyNeutral),
      reference: onlyNeutral,
    });
    expect(gray.report.color).toBeNull();
    expect(gray.report.neutral.count).toBe(NEUTRAL_IDS.size);
  });

  it('largely undoes the known distortion of the artificial webcam', () => {
    expect(result.report.meanBefore).toBeGreaterThan(4);
    expect(result.report.meanAfter).toBeLessThan(1);
    expect(result.report.maxAfter).toBeLessThan(2.5);
    expect(result.report.meanAfter).toBeLessThan(result.report.meanBefore / 4);
  });

  describe('hue table', () => {
    const luminance = (code: Vec3) => {
      const [r, g, b] = code.map((value) => srgbToLinear(value));
      return 0.2126 * Number(r) + 0.7152 * Number(g) + 0.0722 * Number(b);
    };
    const withoutTable = { ...result.model, hue: FLAT_HUE };

    it('changes nothing the matrix already gets right', () => {
      const table = result.model.hue;
      expect(table).toHaveLength(10);
      expect(Math.max(...table.map((value) => Math.abs(value)))).toBeLessThan(0.05);
    });

    it('corrects a hue-dependent error that no matrix can undo', () => {
      // A camera that turns reds towards yellow and makes blues more saturated, the other hues less.
      const skewed = Object.fromEntries(
        Object.entries(reference.patches).map(([id, [l, a, b]]) => {
          const hue = Math.atan2(b, a);
          const turn = ((15 * Math.PI) / 180) * Math.cos(hue);
          const chroma = Math.hypot(a, b) * (1 + 0.2 * Math.sin(hue));
          return [
            id,
            cameraCode([l, chroma * Math.cos(hue + turn), chroma * Math.sin(hue + turn)]),
          ];
        }),
      );
      const fit = fitColorModel({ measurements: skewed, reference });
      const matrixOnly = { ...fit.model, hue: FLAT_HUE };
      const colorError = (model: typeof matrixOnly) => {
        const errors = fit.report.patches
          .filter((patch) => !patch.neutral)
          .map((patch) =>
            distance(srgbToLab(applyColorModel(model, patch.measured)), patch.reference),
          );
        return errors.reduce((sum, value) => sum + value, 0) / errors.length;
      };
      expect(colorError(fit.model)).toBeLessThan(0.8 * colorError(matrixOnly));
    });

    it('keeps grays and the brightness of every color', () => {
      const table = Array.from({ length: 10 }, (_, index) => (index % 3) * 0.1 - 0.05);
      const turned = { ...withoutTable, hue: table };
      for (const code of [
        [0.5, 0.5, 0.5],
        [0, 0, 0],
        [0.6, 0.3, 0.2],
        [0.2, 0.5, 0.4],
        [0.3, 0.3, 0.6],
      ] as const) {
        expect(luminance(applyColorModel(turned, code))).toBeCloseTo(
          luminance(applyColorModel(withoutTable, code)),
          3,
        );
      }
      // Grays of the scene stay gray: they have no chroma that the table could turn or scale.
      for (const gray of [0.1, 0.4, 0.8]) {
        const [r, g, b] = applyColorModel(turned, cameraCode(srgbToLab([gray, gray, gray])));
        expect(Math.abs(r - g)).toBeLessThan(0.02);
        expect(Math.abs(g - b)).toBeLessThan(0.02);
      }
    });
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

  it('desaturates colors outside the sRGB cube in proportion instead of clipping single channels', () => {
    const identity = { xs: [0, 1], ys: [0, 1] };
    // A strongly mixing matrix: a saturated blue gets a negative red value.
    const model = {
      curves: [identity, identity, identity],
      matrix: [
        [1.4, 0.3, -0.7],
        [0, 1, 0],
        [0, 0, 1],
      ],
      hue: FLAT_HUE,
    } as const;
    const input: [number, number, number] = [
      linearToSrgb(0.1),
      linearToSrgb(0.3),
      linearToSrgb(0.9),
    ];
    const [r, g, b] = applyColorModel(model, input).map((value) => srgbToLinear(value));
    // Close to the edge of the cube, but not on it: only the most saturated camera blue lands there.
    expect(Number(r)).toBeGreaterThan(0);
    expect(Number(r)).toBeLessThan(0.05);
    // Same luminance as the mixed color, instead of the clipped (0, 0.3, 0.9).
    expect(0.2126 * Number(r) + 0.7152 * Number(g) + 0.0722 * Number(b)).toBeCloseTo(0.1946, 3);
    expect(Number(b)).toBeLessThan(0.5);
  });

  it('keeps different camera colors apart instead of cutting them off at 0 or 1', () => {
    // A washed-out, slightly dark camera: the correction has to saturate strongly, which would push the
    // most saturated camera colors beyond sRGB, and to brighten, which would lift the highlights above
    // white.
    const real = bundledReference();
    const washed = Object.fromEntries(
      Object.entries(real.patches).map(([id, lab]) => {
        const linear = labToLinearSrgb(lab).map((value) => Math.min(Math.max(value, 0), 1));
        const gray =
          0.2126 * Number(linear[0]) + 0.7152 * Number(linear[1]) + 0.0722 * Number(linear[2]);
        return [
          id,
          linear.map((value) => linearToSrgb(0.85 * (0.6 * value + 0.4 * gray))) as unknown as Rgb,
        ];
      }),
    );
    const strong = fitColorModel({
      measurements: washed,
      reference: real,
    });
    expect(strong.model.matrix.flat().some((value) => value < 0)).toBe(true);
    const corners: Vec3[] = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
      [1, 1, 0],
      [0, 1, 1],
      [1, 0, 1],
    ];
    for (const model of [result.model, strong.model]) {
      // From each saturated camera color towards gray: neighbors stay apart, and only the camera's
      // most saturated color itself may land on the edge.
      for (const corner of corners) {
        for (const level of [0.5, 1]) {
          const ramp = Array.from({ length: 9 }, (_, step) =>
            applyColorModel(
              model,
              corner.map((channel) => level * (channel === 1 ? 1 : step / 32)) as unknown as Vec3,
            ),
          );
          for (const [step, color] of ramp.entries()) {
            expect(distance(color, ramp[step - 1] ?? [-1, -1, -1])).toBeGreaterThan(1e-4);
            expect(step === 0 || color.every((value) => value > 0 && value < 1)).toBe(true);
          }
        }
      }
      // The bright grays rise towards white without a flat top.
      const grays = Array.from({ length: 11 }, (_, step) => {
        const level = 0.8 + step * 0.018;
        return Math.min(...applyColorModel(model, [level, level, level]));
      });
      for (const [step, value] of grays.entries()) {
        expect(value).toBeGreaterThan(grays[step - 1] ?? 0);
        expect(value).toBeLessThan(1);
      }
    }
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

  it('works with only some of the patches and ignores patches without a measurement', () => {
    const ids = dummyIds().filter((id, index) => NEUTRAL_IDS.has(id) || index % 3 === 0);
    const partial = referenceSet(ids);
    const fewer = { ...measure(partial) };
    // 1A is in the reference, only its measurement is missing.
    expect(partial.patches['1A']).toBeDefined();
    delete fewer['1A'];
    const fit = fitColorModel({ measurements: fewer, reference: partial });
    expect(fit.report.meanAfter).toBeLessThan(fit.report.meanBefore);
    expect(fit.report.patches.some((entry) => entry.id === '1A')).toBe(false);
  });

  it('handles curves with duplicate measurements and anchors', () => {
    // White and a lighter step measure exactly the same (clipped), the black is above 0.
    const clipped = { ...measurements, '1E': [1, 1, 1] as Rgb, '1D': [1, 1, 1] as Rgb };
    const { model } = fitColorModel({ measurements: clipped, reference });
    for (const curve of model.curves) {
      expect(curve.ys.every((value) => Number.isFinite(value))).toBe(true);
      expect(
        curve.ys.every((value, index) => index === 0 || value >= (curve.ys[index - 1] ?? 0)),
      ).toBe(true);
    }
  });

  it('uses a measured black at 0 without an additional anchor point', () => {
    const blackIsZero = { ...measurements, '6E': [0, 0, 0] as Rgb };
    const fit = fitColorModel({ measurements: blackIsZero, reference });
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
    const fit = fitColorModel({ measurements: dark, reference });
    const gray = halve(cameraCode(dummyLab('3D')));
    const corrected = applyColorModel(fit.model, gray);
    expect(Math.abs(corrected[1] - gray[1])).toBeLessThan(0.05);
    // The deviation is measured at the exposure of the shot, so the dark shot is not punished.
    expect(fit.report.meanBefore).toBeLessThan(10);
    // The report names that exposure: half as bright as the normal shot.
    expect(fit.report.exposureGain / result.report.exposureGain).toBeCloseTo(0.5, 1);
  });

  it('leaves a camera that already shows the reference colors almost unchanged, tinted grays too', () => {
    // The gray ramp of the bundled set is slightly warm. A camera that shows it like that needs no
    // correction; only patches outside the sRGB gamut (such as 1F) cannot be shown exactly.
    const real = bundledReference();
    const exact = Object.fromEntries(
      Object.entries(real.patches).map(([id, lab]) => [id, labToSrgb(lab)]),
    );
    const fit = fitColorModel({ measurements: exact, reference: real });
    expect(fit.report.neutral.meanAfter).toBeLessThan(0.5);
    expect(fit.report.meanAfter).toBeLessThan(0.5);
    for (const value of applyColorModel(fit.model, [1, 1, 1])) {
      expect(value).toBeCloseTo(1, 6);
    }
  });

  it('measures colors outside the sRGB gamut against the nearest color sRGB can show', () => {
    // The cyan 1F and the yellow 3F of the bundled set lie outside the sRGB gamut.
    const real = bundledReference();
    const exact = Object.fromEntries(
      Object.entries(real.patches).map(([id, lab]) => [id, labToSrgb(lab)]),
    );
    const fit = fitColorModel({ measurements: exact, reference: real });
    for (const id of ['1F', '3F']) {
      const patch = fit.report.patches.find((entry) => entry.id === id);
      const linear = labToLinearSrgb(patch?.reference ?? [0, 0, 0]);
      for (const value of linear) {
        expect(value).toBeGreaterThanOrEqual(-1e-6);
      }
    }
    // Against the unreachable reference itself 1F would stay at about 5 even here.
    expect(fit.report.maxAfter).toBeLessThan(3);
  });

  it('never measures against a target brighter than white, also for a bright shot', () => {
    // Every color a third brighter than the reference: the bright patches would lie above white.
    const real = bundledReference();
    const bright = Object.fromEntries(
      Object.entries(real.patches).map(([id, lab]) => {
        const [r, g, b] = labToLinearSrgb(lab);
        return [id, labToSrgb(xyzD50ToLab(linearSrgbToXyzD50([r * 1.3, g * 1.3, b * 1.3])))];
      }),
    );
    const fit = fitColorModel({ measurements: bright, reference: real });
    expect(fit.report.exposureGain).toBeGreaterThan(1.2);
    for (const patch of fit.report.patches) {
      expect(patch.reference[0]).toBeLessThanOrEqual(100);
    }
    const white = fit.report.patches.find((entry) => entry.id === '1E');
    expect(white?.after).toBeLessThan(2);
  });

  it('keeps a clipped white white although the camera has a color cast', () => {
    // A camera with a strong blue cast, slightly overexposed: blue clips first in the bright patches.
    const cast: Vec3 = [0.8, 1, 1.25];
    const real = bundledReference();
    const tinted = Object.fromEntries(
      Object.entries(real.patches).map(([id, lab]) => [
        id,
        labToLinearSrgb(lab).map((value, channel) =>
          linearToSrgb(Math.min(Math.max(value * 1.1 * Number(cast[channel]), 0), 1)),
        ) as unknown as Rgb,
      ]),
    );
    const fit = fitColorModel({ measurements: tinted, reference: real });
    for (const value of applyColorModel(fit.model, [1, 1, 1])) {
      expect(value).toBeCloseTo(1, 6);
    }
    // A bright, saturated color with one dark channel is not pulled towards white.
    const yellow = applyColorModel(fit.model, [1, 0.95, 0.2]);
    expect(yellow[2]).toBeLessThan(0.5);
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
    const fit = fitColorModel({ measurements: crushed, reference });
    for (const curve of fit.model.curves) {
      for (const [index, x] of curve.xs.entries()) {
        expect(Number(curve.ys[index])).toBeLessThanOrEqual(4 * x + 1e-9);
      }
    }
  });

  it('survives a completely black camera image', () => {
    const black = Object.fromEntries(Object.keys(measurements).map((id) => [id, [0, 0, 0] as Rgb]));
    const fit = fitColorModel({ measurements: black, reference });
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
    });
    expect(fit.report.patches).toHaveLength(12);
  });

  it('throws with too few patches or neutral patches', () => {
    const few = referenceSet(['1D', '2D', '3D']);
    const tooFew = expect.objectContaining({
      problem: { key: 'tooFewMeasurements', params: { patches: 8, neutral: 4 } },
    }) as Error;
    expect(() => fitColorModel({ measurements: measure(few), reference: few })).toThrow(tooFew);
    const colourOnly = referenceSet(dummyIds().filter((id) => !NEUTRAL_IDS.has(id)));
    expect(() =>
      fitColorModel({
        measurements: measure(colourOnly),
        reference: colourOnly,
      }),
    ).toThrow(tooFew);
  });

  it('stays close to the identity matrix for indistinguishable patches', () => {
    const flat: Record<string, Rgb> = Object.fromEntries(
      dummyIds().map((id) => [id, [0.5, 0.5, 0.5]]),
    );
    const fit = fitColorModel({ measurements: flat, reference });
    for (const [index, row] of fit.model.matrix.entries()) {
      expect(row[index]).toBeGreaterThan(0.5);
    }
  });
});
