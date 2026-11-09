// Packs bytes with deflate and writes them as Base64, and back: the binary parts of the project file
// (still images and look LUTs) stay small and remain plain JSON text.
export type Bytes = Uint8Array<ArrayBuffer>;

const CHUNK = 0x80_00;

// Sends the bytes through the packer or unpacker and collects what comes out; the streams of the
// browser do the reading and writing. With corrupt or truncated data the pipe rejects. (Reading the
// output through a Response would make Firefox log the rejection to the console as well.)
async function pump(stream: CompressionStream | DecompressionStream, bytes: Bytes): Promise<Bytes> {
  const chunks: Bytes[] = [];
  const collect = new WritableStream<Bytes>({
    write: (chunk) => {
      chunks.push(chunk);
    },
  });
  await new Blob([bytes]).stream().pipeThrough(stream).pipeTo(collect);
  return new Uint8Array(await new Blob(chunks).arrayBuffer());
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
