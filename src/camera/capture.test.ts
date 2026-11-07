import { describe, expect, it, vi } from 'vitest';

import { captureAveraged } from './capture';
import type { RawFrame } from './frame';

describe('captureAveraged', () => {
  it('averages eight frames and waits for the next frame between them', async () => {
    const grab = vi
      .fn<() => RawFrame>()
      .mockReturnValueOnce({ width: 1, height: 1, data: [255, 0, 0, 255] })
      .mockReturnValue({ width: 1, height: 1, data: [0, 0, 0, 255] });
    const nextFrame = vi.fn(() => Promise.resolve());
    const frame = await captureAveraged({ grab, nextFrame });
    expect(grab).toHaveBeenCalledTimes(8);
    expect(nextFrame).toHaveBeenCalledTimes(7);
    expect([...frame.data]).toEqual([1 / 8, 0, 0]);
  });
});
