import type { FrameGrabber } from '../camera/capture';
import { createVideoGrabber } from '../camera/video-grabber';

// Verbindet einen Kamera-Stream mit dem Video-Element (falls vorhanden) und startet die Wiedergabe.
export function attachStream(element: HTMLVideoElement | null, stream: MediaStream | null): void {
  if (element !== null) {
    element.srcObject = stream;
    if (stream !== null) {
      void element.play();
    }
  }
}

// Nimmt über das Video-Element ein Standbild auf (falls das Element vorhanden ist).
export function captureFromVideo(
  element: HTMLVideoElement | null,
  capture: (grabber: FrameGrabber) => Promise<void>,
): void {
  if (element !== null) {
    void capture(createVideoGrabber(element, () => document.createElement('canvas')));
  }
}
