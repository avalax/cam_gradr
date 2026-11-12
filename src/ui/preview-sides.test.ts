import { describe, expect, it } from 'vitest';

import { previewSides } from './preview-sides';

describe('previewSides', () => {
  it('shows the camera image left and the correction right without a look', () => {
    expect(previewSides(false, 'corrected', 'camera', false)).toEqual({
      leftCorrected: false,
      rightCamera: false,
      leftName: 'Kamera',
      rightName: 'Korrigiert',
    });
  });

  it('lays the look over the correction or the camera image and names both sides', () => {
    expect(previewSides(true, 'camera', 'corrected', false)).toMatchObject({
      leftName: 'Kamera',
      rightName: 'Korrigiert + Look-LUT',
    });
    expect(previewSides(true, 'corrected', 'camera', false)).toEqual({
      leftCorrected: true,
      rightCamera: true,
      leftName: 'Korrigiert',
      rightName: 'Kamera + Look-LUT',
    });
  });

  it('names the image without correction after the still image while the preview shows one', () => {
    expect(previewSides(false, 'camera', 'corrected', true)).toMatchObject({
      leftName: 'Standbild',
      rightName: 'Korrigiert',
    });
    expect(previewSides(true, 'corrected', 'camera', true)).toMatchObject({
      leftName: 'Korrigiert',
      rightName: 'Standbild + Look-LUT',
    });
  });
});
