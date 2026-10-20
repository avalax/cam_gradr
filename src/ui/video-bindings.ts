import type { FrameGrabber } from '../camera/capture';
import { averageFrames } from '../camera/frame';
import type { Frame } from '../camera/frame';
import { createVideoGrabber } from '../camera/video-grabber';

// Starts playback. If the element is removed beforehand (tab switch), play() aborts; that is
// harmless here.
async function play(element: HTMLVideoElement): Promise<void> {
  try {
    await element.play();
  } catch {
    // Ignore aborted playback.
  }
}

// Connects a camera stream to the video element (if present) and starts playback.
export function attachStream(element: HTMLVideoElement | null, stream: MediaStream | null): void {
  if (element !== null) {
    element.srcObject = stream;
    if (stream !== null) {
      void play(element);
    }
  }
}

// Captures a still image via the video element (if the element is present).
export async function captureFromVideo(
  element: HTMLVideoElement | null,
  capture: (grabber: FrameGrabber) => Promise<void>,
): Promise<void> {
  if (element !== null) {
    await capture(createVideoGrabber(element, () => document.createElement('canvas')));
  }
}

// Reads the current video image as a frame as long as the video already delivers an image (else
// null).
export function grabVideoFrame(element: HTMLVideoElement | null): Frame | null {
  return element !== null && element.videoWidth > 0
    ? averageFrames([createVideoGrabber(element, () => document.createElement('canvas')).grab()])
    : null;
}
