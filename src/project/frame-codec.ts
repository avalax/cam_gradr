import type { Frame } from '../camera/frame';
import { CHANNELS, MAX_CODE, toByte } from '../color/srgb';
import { t } from '../lang';

import { packBase64, unpackBase64 } from './deflate';
import type { Bytes } from './deflate';

// A still image in the project file: RGB with 8 bits per channel, packed with deflate and written as
// Base64.
// The rounding to 8 bits loses the finer steps of the averaged still, so a measurement after loading
// (when a corner is moved) can differ slightly from the saved one.
export const FRAME_ENCODING = 'rgb8-deflate-base64';

export interface EncodedFrame {
  width: number;
  height: number;
  encoding: typeof FRAME_ENCODING;
  data: string;
}

export async function encodeFrame(frame: Frame): Promise<EncodedFrame> {
  const raw = new Uint8Array(frame.width * frame.height * CHANNELS);
  for (const [index, value] of frame.data.entries()) {
    raw[index] = toByte(value);
  }
  return {
    width: frame.width,
    height: frame.height,
    encoding: FRAME_ENCODING,
    data: await packBase64(raw),
  };
}

export async function decodeFrame(encoded: EncodedFrame): Promise<Frame> {
  let raw: Bytes;
  try {
    raw = await unpackBase64(encoded.data);
  } catch (error) {
    throw new Error(t('project.errors.frameUnreadable'), { cause: error });
  }
  if (raw.length !== encoded.width * encoded.height * CHANNELS) {
    throw new RangeError(t('project.errors.frameWrongSize'));
  }
  const data = new Float32Array(raw.length);
  for (const [index, value] of raw.entries()) {
    data[index] = value / MAX_CODE;
  }
  return { width: encoded.width, height: encoded.height, data };
}
