import type { Frame } from '../camera/frame';
import type { PixelGrid } from '../chart/types';

// Pixel grid of an averaged still image (RGB, values 0..1).
export function frameGrid(frame: Frame): PixelGrid {
  return { width: frame.width, height: frame.height, data: frame.data, channels: 3, maxValue: 1 };
}
