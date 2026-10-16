import type { FrameGrabber } from './capture';
import type { RawFrame } from './frame';

interface Context2DLike {
  drawImage: (source: HTMLVideoElement, x: number, y: number) => void;
  getImageData: (x: number, y: number, width: number, height: number) => RawFrame;
}

export interface CanvasLike {
  width: number;
  height: number;
  getContext: (id: '2d', options?: CanvasRenderingContext2DSettings) => Context2DLike | null;
}

const FALLBACK_FRAME_MS = 33;

// Dünner Adapter: liest Frames aus einem <video>-Element über ein Canvas.
export function createVideoGrabber(
  video: HTMLVideoElement,
  createCanvas: () => CanvasLike,
): FrameGrabber {
  return {
    grab(): RawFrame {
      const canvas = createCanvas();
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (context === null) {
        throw new Error('Canvas-Kontext nicht verfügbar.');
      }
      context.drawImage(video, 0, 0);
      return context.getImageData(0, 0, canvas.width, canvas.height);
    },

    nextFrame(): Promise<void> {
      return new Promise((resolve) => {
        if (typeof video.requestVideoFrameCallback === 'function') {
          video.requestVideoFrameCallback(() => {
            resolve();
          });
        } else {
          setTimeout(resolve, FALLBACK_FRAME_MS);
        }
      });
    },
  };
}
