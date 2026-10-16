import { averageFrames } from './frame';
import type { Frame, RawFrame } from './frame';

export interface FrameGrabber {
  grab: () => RawFrame;
  nextFrame: () => Promise<void>;
}

// Nimmt `count` aufeinanderfolgende Frames auf und mittelt sie.
export async function captureAveraged(grabber: FrameGrabber, count: number): Promise<Frame> {
  if (!Number.isSafeInteger(count) || count < 1) {
    throw new RangeError('Die Anzahl der Frames muss eine ganze Zahl >= 1 sein.');
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
