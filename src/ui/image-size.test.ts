import { describe, expect, it } from 'vitest';

import type { Frame } from '../camera/frame';

import { previewImage } from './image-size';

function frame(width: number, height: number): Frame {
  return { width, height, data: new Float32Array(0) };
}

describe('previewImage', () => {
  const none = { corrected: true, live: false, stills: {}, actual: null };

  it('has no image without a correction or without a source, at 16:9', () => {
    expect(previewImage(none)).toEqual({ shown: false, aspect: 16 / 9 });
    expect(previewImage({ ...none, corrected: false, stills: { color: frame(4, 3) } })).toEqual({
      shown: false,
      aspect: 4 / 3,
    });
  });

  it('shows its own still image first, else the one of the color cards', () => {
    const stills = { preview: frame(2, 1), color: frame(4, 3) };
    expect(previewImage({ ...none, stills })).toEqual({ shown: true, aspect: 2 });
    expect(previewImage({ ...none, stills: { color: frame(4, 3) } }).aspect).toBe(4 / 3);
  });

  it('shows the live image while the camera runs, at the size the camera delivers', () => {
    const live = { ...none, live: true, stills: { color: frame(4, 3) } };
    expect(previewImage({ ...live, actual: { width: 1920, height: 1080 } })).toEqual({
      shown: true,
      aspect: 16 / 9,
    });
    expect(previewImage(live).shown).toBe(false);
  });
});
