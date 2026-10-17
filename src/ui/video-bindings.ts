import type { FrameGrabber } from '../camera/capture';
import { averageFrames } from '../camera/frame';
import type { Frame } from '../camera/frame';
import { createVideoGrabber } from '../camera/video-grabber';

// Startet die Wiedergabe. Wird das Element vorher entfernt (Tabwechsel), bricht play() ab; das ist
// hier ohne Folgen.
async function play(element: HTMLVideoElement): Promise<void> {
  try {
    await element.play();
  } catch {
    // Abgebrochene Wiedergabe ignorieren.
  }
}

// Verbindet einen Kamera-Stream mit dem Video-Element (falls vorhanden) und startet die Wiedergabe.
export function attachStream(element: HTMLVideoElement | null, stream: MediaStream | null): void {
  if (element !== null) {
    element.srcObject = stream;
    if (stream !== null) {
      void play(element);
    }
  }
}

// Nimmt über das Video-Element ein Standbild auf (falls das Element vorhanden ist).
export async function captureFromVideo(
  element: HTMLVideoElement | null,
  capture: (grabber: FrameGrabber) => Promise<void>,
): Promise<void> {
  if (element !== null) {
    await capture(createVideoGrabber(element, () => document.createElement('canvas')));
  }
}

// Liest das aktuelle Videobild als Frame, solange das Video schon ein Bild liefert (sonst null).
export function grabVideoFrame(element: HTMLVideoElement | null): Frame | null {
  return element !== null && element.videoWidth > 0
    ? averageFrames([createVideoGrabber(element, () => document.createElement('canvas')).grab()])
    : null;
}
