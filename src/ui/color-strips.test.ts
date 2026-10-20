import { describe, expect, it } from 'vitest';

import { labToSrgb } from '../color/lab';
import { applyColorModel } from '../solve/fit';
import type { ColorModel } from '../solve/fit';

import { cssColor } from './color-css';
import { NEUTRAL_SWATCH, buildStrips } from './color-strips';

const IDENTITY: ColorModel = {
  curves: [
    { xs: [0, 1], ys: [0, 1] },
    { xs: [0, 1], ys: [0, 1] },
    { xs: [0, 1], ys: [0, 1] },
  ],
  matrix: [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
};
const BRIGHTEN: ColorModel = {
  ...IDENTITY,
  curves: [{ xs: [0, 1], ys: [0.2, 1] }, IDENTITY.curves[1], IDENTITY.curves[2]],
};
const REFERENCE = { name: 'Test', patches: { '1A': [50, 20, -10] as const } };
const IDS = ['1A', '1B'];

describe('buildStrips', () => {
  it('shows the reference target values without a measurement and model, and neutral gray otherwise', () => {
    const { camera, corrected } = buildStrips(IDS, {}, null, REFERENCE);
    const expected = cssColor(labToSrgb([50, 20, -10]));
    expect(camera).toEqual([
      { id: '1A', css: expected, measured: false },
      { id: '1B', css: NEUTRAL_SWATCH, measured: false },
    ]);
    expect(corrected).toEqual(camera);
  });

  it('uses neutral gray without a reference', () => {
    const { camera } = buildStrips(IDS, {}, null, null);
    expect(camera.map((swatch) => swatch.css)).toEqual([NEUTRAL_SWATCH, NEUTRAL_SWATCH]);
  });

  it('shows the measured colors on the left and, without a model, exactly the same on the right', () => {
    const { camera, corrected } = buildStrips(IDS, { '1A': [1, 0, 0] }, null, REFERENCE);
    expect(camera[0]).toEqual({ id: '1A', css: 'rgb(255, 0, 0)', measured: true });
    expect(camera[1]?.measured).toBe(false);
    expect(corrected[0]?.measured).toBe(false);
    expect(corrected[0]?.css).toBe('rgb(255, 0, 0)');
    expect(corrected[1]?.css).toBe(camera[1]?.css);
  });

  it('applies the correction model to the measured colors', () => {
    const measured = [0.4, 0.5, 0.6] as const;
    const { corrected } = buildStrips(IDS, { '1B': measured }, BRIGHTEN, REFERENCE);
    expect(corrected[1]).toEqual({
      id: '1B',
      css: cssColor(applyColorModel(BRIGHTEN, measured)),
      measured: true,
    });
    expect(corrected[0]?.measured).toBe(false);
  });
});
