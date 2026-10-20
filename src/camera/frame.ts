export interface RawFrame {
  width: number;
  height: number;
  data: ArrayLike<number>;
}

// Averaged frame: RGB, sRGB-encoded, values 0..1.
export interface Frame {
  width: number;
  height: number;
  data: Float32Array;
}

const CHANNELS_IN = 4;
const CHANNELS_OUT = 3;
const MAX_CODE = 255;

// Averages several RGBA frames of equal size into one RGB frame (noise reduction).
export function averageFrames(frames: readonly RawFrame[]): Frame {
  const first = frames[0];
  if (first === undefined) {
    throw new Error('At least one frame is required.');
  }
  for (const frame of frames) {
    if (frame.width !== first.width || frame.height !== first.height) {
      throw new Error('All frames must have the same size.');
    }
  }
  const scale = 1 / (frames.length * MAX_CODE);
  const data = new Float32Array(first.width * first.height * CHANNELS_OUT);
  for (let index = 0; index < data.length; index++) {
    const source = Math.floor(index / CHANNELS_OUT) * CHANNELS_IN + (index % CHANNELS_OUT);
    let total = 0;
    for (const frame of frames) {
      total += frame.data[source] ?? 0;
    }
    data[index] = total * scale;
  }
  return { width: first.width, height: first.height, data };
}
