import { describe, expect, it } from 'vitest';

import type { LookLut } from '../look/look';

import { LOOK_ENCODING, decodeLook, encodeLook } from './look-codec';

function look(): LookLut {
  const data = Float32Array.from({ length: 2 ** 3 * 3 }, (_, index) => index / 7 - 0.4);
  return { name: 'Warm', lut: { size: 2, data }, min: [0, 0, -0.1], max: [1, 1, 1.1] };
}

describe('look-codec', () => {
  it('writes the look LUT with size and input range and reads it back exactly', async () => {
    const encoded = await encodeLook(look());
    expect(encoded).toMatchObject({
      name: 'Warm',
      size: 2,
      min: [0, 0, -0.1],
      max: [1, 1, 1.1],
      encoding: LOOK_ENCODING,
    });
    const decoded = await decodeLook(encoded);
    expect(decoded.name).toBe('Warm');
    expect(decoded.lut.size).toBe(2);
    expect([...decoded.lut.data]).toEqual([...look().lut.data]);
    expect(decoded.min).toEqual([0, 0, -0.1]);
  });

  it('reports data that cannot be unpacked', async () => {
    const encoded = { ...(await encodeLook(look())), data: 'kein deflate' };
    await expect(decodeLook(encoded)).rejects.toThrow(
      'gespeicherte Look-LUT „Warm“ lässt sich nicht lesen',
    );
  });

  it('reports a wrong size', async () => {
    const encoded = { ...(await encodeLook(look())), size: 3 };
    await expect(decodeLook(encoded)).rejects.toThrow('nicht die angegebene Größe');
  });
});
