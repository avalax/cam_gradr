import type { Frame } from '../camera/frame';

// Ein Standbild in der Projektdatei: RGB mit 8 Bit je Kanal, mit deflate gepackt und als Base64 geschrieben.
// Das ist verlustfrei bis auf die Rundung auf 8 Bit (die Anzeige und Messung arbeiten ohnehin damit).
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

// Schickt die Bytes durch den Packer oder Entpacker. Das Lesen läuft gleichzeitig mit dem Schreiben,
// sonst staut sich der Strom.
async function pump(stream: CompressionStream | DecompressionStream, bytes: Bytes): Promise<Bytes> {
  const writer = stream.writable.getWriter();
  const writing = (async () => {
    await writer.write(bytes);
    await writer.close();
  })();
  // Beide Seiten werden zusammen abgewartet: Bei defekten Daten scheitern beide, und keine Ablehnung
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
    throw new Error('Ein Standbild in der Datei lässt sich nicht lesen', { cause: error });
  }
  if (raw.length !== encoded.width * encoded.height * CHANNELS) {
    throw new RangeError('Ein Standbild in der Datei hat nicht die angegebene Größe');
  }
  const data = new Float32Array(raw.length);
  for (const [index, value] of raw.entries()) {
    data[index] = value / MAX_CODE;
  }
  return { width: encoded.width, height: encoded.height, data };
}
