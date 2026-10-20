import { describe, expect, it } from 'vitest';

import { frameGrid } from './gray-monitor';

describe('frameGrid', () => {
  it('describes an averaged RGB frame as a pixel grid', () => {
    const data = new Float32Array([0.1, 0.2, 0.3]);
    expect(frameGrid({ width: 1, height: 1, data })).toEqual({
      width: 1,
      height: 1,
      data,
      channels: 3,
      maxValue: 1,
    });
  });
});
