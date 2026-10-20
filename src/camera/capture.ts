import { averageFrames } from './frame';
import type { Frame, RawFrame } from './frame';

export interface FrameGrabber {
  grab: () => RawFrame;
  nextFrame: () => Promise<void>;
}

// Captures `count` consecutive frames and averages them.
export async function captureAveraged(grabber: FrameGrabber, count: number): Promise<Frame> {
  if (!Number.isSafeInteger(count) || count < 1) {
    throw new RangeError('The number of frames must be an integer >= 1.');
  }
  const frames: RawFrame[] = [];
  for (let index = 0; index < count; index++) {
    if (index > 0) {
      await grabber.nextFrame();
    }
    frames.push(grabber.grab());
  }
  return averageFrames(frames);
}
