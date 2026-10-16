import { describe, expect, it, vi } from 'vitest';

import { captureAveraged } from './capture';

describe('captureAveraged', () => {
  it('nimmt count Frames auf und wartet zwischen den Frames', async () => {
    const grab = vi.fn(() => ({ width: 1, height: 1, data: [255, 0, 0, 255] }));
    const nextFrame = vi.fn(() => Promise.resolve());
    const frame = await captureAveraged({ grab, nextFrame }, 3);
    expect(grab).toHaveBeenCalledTimes(3);
    expect(nextFrame).toHaveBeenCalledTimes(2);
    expect([...frame.data]).toEqual([1, 0, 0]);
  });

  it('wartet bei einem einzelnen Frame nicht', async () => {
    const nextFrame = vi.fn(() => Promise.resolve());
    await captureAveraged(
      { grab: () => ({ width: 1, height: 1, data: [0, 0, 0, 0] }), nextFrame },
      1,
    );
    expect(nextFrame).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.5, NaN])('lehnt count %s ab', async (count) => {
    const grabber = { grab: vi.fn(), nextFrame: vi.fn() };
    await expect(captureAveraged(grabber, count)).rejects.toThrow(RangeError);
  });
});
