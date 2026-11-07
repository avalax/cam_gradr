import { averageFrames } from './frame';
import type { Frame, RawFrame } from './frame';

export interface FrameGrabber {
  grab: () => RawFrame;
  nextFrame: () => Promise<void>;
}

// Number of consecutive frames averaged into a still image (noise reduction).
const FRAME_COUNT = 8;

// Captures consecutive frames and averages them.
export async function captureAveraged(grabber: FrameGrabber): Promise<Frame> {
  const frames: RawFrame[] = [];
  for (let index = 0; index < FRAME_COUNT; index++) {
    if (index > 0) {
      await grabber.nextFrame();
    }
    frames.push(grabber.grab());
  }
  return averageFrames(frames);
}
