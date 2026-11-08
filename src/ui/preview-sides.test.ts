import { describe, expect, it } from 'vitest';

import { previewSides } from './preview-sides';

describe('previewSides', () => {
  it('shows the camera image left and the correction right without a look', () => {
    expect(previewSides(false, 'corrected', 'camera')).toEqual({
      leftCorrected: false,
      rightCamera: false,
      leftName: 'Kamera',
      rightName: 'Korrigiert',
    });
  });

  it('lays the look over the correction or the camera image and names both sides', () => {
    expect(previewSides(true, 'camera', 'corrected')).toMatchObject({
      leftName: 'Kamera',
      rightName: 'Korrigiert + Look-LUT',
    });
    expect(previewSides(true, 'corrected', 'camera')).toEqual({
      leftCorrected: true,
      rightCamera: true,
      leftName: 'Korrigiert',
      rightName: 'Kamera + Look-LUT',
    });
  });
});
