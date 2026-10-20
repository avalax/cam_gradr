import type { Frame } from '../camera/frame';
import { t } from '../lang';

// A still image in the project file: RGB with 8 bits per channel, packed with deflate and written as
// Base64.
// This is lossless apart from the rounding to 8 bits (display and measurement work with that anyway).
export const FRAME_ENCODING = 'rgb8-deflate-base64';

export interface EncodedFrame {
  width: number;
  height: number;
  encoding: typeof FRAME_ENCODING;
  data: string;
}

type Bytes = Uint8Array<ArrayBuffer>;

const CHANNELS = 3;
const MAX_CODE = 255;
const CHUNK = 0x80_00;

async function collect(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<Bytes> {
  const chunks: Uint8Array[] = [];
  let total = 0;
  let next = await reader.read();
  while (!next.done) {
    chunks.push(next.value);
    total += next.value.length;
    next = await reader.read();
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

// Sends the bytes through the packer or unpacker. Reading runs concurrently with writing,
// otherwise the stream backs up.
async function pump(stream: CompressionStream | DecompressionStream, bytes: Bytes): Promise<Bytes> {
  const writer = stream.writable.getWriter();
  const writing = (async () => {
    await writer.write(bytes);
    await writer.close();
  })();
  // Both sides are awaited together: with corrupt data both fail, and no rejection
  // bleibt unbehandelt.
  const [, output] = await Promise.all([writing, collect(stream.readable.getReader())]);
  return output;
}

function toBase64(bytes: Bytes): string {
  let text = '';
  for (let offset = 0; offset < bytes.length; offset += CHUNK) {
    const part = bytes.subarray(offset, offset + CHUNK);
    text += String.fromCodePoint(...part);
  }
  return btoa(text);
}

function fromBase64(text: string): Bytes {
  const binary = atob(text);
  return Uint8Array.from(binary, (character) => character.codePointAt(0) ?? 0);
}

function toCode(value: number): number {
  const clamped = Math.min(Math.max(value, 0), 1);
  return Math.round(clamped * MAX_CODE);
}

export async function encodeFrame(frame: Frame): Promise<EncodedFrame> {
  const raw = new Uint8Array(frame.width * frame.height * CHANNELS);
  for (const [index, value] of frame.data.entries()) {
    raw[index] = toCode(value);
  }
  const packed = await pump(new CompressionStream('deflate'), raw);
  return {
    width: frame.width,
    height: frame.height,
    encoding: FRAME_ENCODING,
    data: toBase64(packed),
  };
}

export async function decodeFrame(encoded: EncodedFrame): Promise<Frame> {
  let raw: Bytes;
  try {
    raw = await pump(new DecompressionStream('deflate'), fromBase64(encoded.data));
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
