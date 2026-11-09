import type { Frame } from '../camera/frame';

// A still image of one gray value (0..1) in every channel.
export function grayFrame(width: number, height: number, value = 0): Frame {
  return { width, height, data: new Float32Array(width * height * 3).fill(value) };
}
