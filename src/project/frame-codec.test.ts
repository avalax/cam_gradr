import { describe, expect, it } from 'vitest';

import type { Frame } from '../camera/frame';

import { FRAME_ENCODING, decodeFrame, encodeFrame } from './frame-codec';

function gradient(width: number, height: number): Frame {
  const data = new Float32Array(width * height * 3);
  for (let index = 0; index < data.length; index++) {
    data[index] = (index % 251) / 250;
  }
  return { width, height, data };
}

describe('frame-codec', () => {
  it('writes an image with size and encoding and reads it back up to the 8-bit rounding', async () => {
    const frame = gradient(16, 9);
    const encoded = await encodeFrame(frame);
    expect(encoded.width).toBe(16);
    expect(encoded.height).toBe(9);
    expect(encoded.encoding).toBe(FRAME_ENCODING);
    expect(typeof encoded.data).toBe('string');
    const decoded = await decodeFrame(encoded);
    expect(decoded.width).toBe(16);
    expect(decoded.height).toBe(9);
    expect(decoded.data).toHaveLength(frame.data.length);
    for (const [index, value] of decoded.data.entries()) {
      expect(Math.abs(value - Number(frame.data[index]))).toBeLessThanOrEqual(0.5 / 255 + 1e-6);
    }
  });

  it('clamps values outside 0 to 1', async () => {
    const frame: Frame = { width: 1, height: 1, data: new Float32Array([-0.5, 0.5, 2]) };
    const decoded = await decodeFrame(await encodeFrame(frame));
    expect(decoded.data[0]).toBe(0);
    expect(decoded.data[1]).toBeCloseTo(128 / 255, 5);
    expect(decoded.data[2]).toBe(1);
  });

  it('packs a larger image much smaller than the raw data', async () => {
    const encoded = await encodeFrame(gradient(256, 144));
    expect(encoded.data.length).toBeLessThan(256 * 144 * 3);
  });

  it('reports data that cannot be unpacked', async () => {
    await expect(
      decodeFrame({ width: 1, height: 1, encoding: FRAME_ENCODING, data: 'AAAA' }),
    ).rejects.toThrow('lässt sich nicht lesen');
  });

  it('reports a wrong size', async () => {
    const encoded = await encodeFrame(gradient(4, 4));
    await expect(decodeFrame({ ...encoded, width: 5 })).rejects.toThrow(
      'nicht die angegebene Größe',
    );
  });
});
