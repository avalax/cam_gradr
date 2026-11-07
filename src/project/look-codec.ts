import type { Vec3 } from '../color/lab';
import { t } from '../lang';
import type { LookLut } from '../look/look';

import { packBase64, unpackBase64 } from './deflate';
import type { Bytes } from './deflate';

// A look LUT in the project file: its values as 32-bit floats (little-endian), packed with deflate
// and written as Base64, so that it comes back exactly; name, size and input range stand beside them.
export const LOOK_ENCODING = 'f32le-deflate-base64';

export interface EncodedLook {
  name: string;
  size: number;
  min: Vec3;
  max: Vec3;
  encoding: typeof LOOK_ENCODING;
  data: string;
}

const BYTES_PER_VALUE = 4;
const CHANNELS = 3;

export async function encodeLook(look: LookLut): Promise<EncodedLook> {
  const bytes = new Uint8Array(look.lut.data.length * BYTES_PER_VALUE);
  const view = new DataView(bytes.buffer);
  for (const [index, value] of look.lut.data.entries()) {
    view.setFloat32(index * BYTES_PER_VALUE, value, true);
  }
  return {
    name: look.name,
    size: look.lut.size,
    min: look.min,
    max: look.max,
    encoding: LOOK_ENCODING,
    data: await packBase64(bytes),
  };
}

export async function decodeLook(encoded: EncodedLook): Promise<LookLut> {
  const { name } = encoded;
  let bytes: Bytes;
  try {
    bytes = await unpackBase64(encoded.data);
  } catch (error) {
    throw new Error(t('project.errors.lookUnreadable', { name }), { cause: error });
  }
  const count = encoded.size ** 3 * CHANNELS;
  if (bytes.length !== count * BYTES_PER_VALUE) {
    throw new RangeError(t('project.errors.lookWrongSize', { name }));
  }
  const view = new DataView(bytes.buffer);
  const data = new Float32Array(count);
  for (let index = 0; index < count; index++) {
    data[index] = view.getFloat32(index * BYTES_PER_VALUE, true);
  }
  return { name, lut: { size: encoded.size, data }, min: encoded.min, max: encoded.max };
}
