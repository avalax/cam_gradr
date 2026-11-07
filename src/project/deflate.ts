// Packs bytes with deflate and writes them as Base64, and back: the binary parts of the project file
// (still images and look LUTs) stay small and remain plain JSON text.
export type Bytes = Uint8Array<ArrayBuffer>;

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
  // Both sides are awaited together: with corrupt data both fail, and no rejection is left
  // unhandled.
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
  // eslint-disable-next-line unicorn/prefer-code-point -- atob gives one byte per character, which charCodeAt reads; codePointAt would add an undefined case that cannot occur
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function packBase64(bytes: Bytes): Promise<string> {
  return toBase64(await pump(new CompressionStream('deflate'), bytes));
}

// Throws on text that is not Base64 or not packed with deflate.
export async function unpackBase64(text: string): Promise<Bytes> {
  return pump(new DecompressionStream('deflate'), fromBase64(text));
}
