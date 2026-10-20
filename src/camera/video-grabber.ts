import { t } from '../lang';

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

const FALLBACK_FRAME_MS = 100;

// Thin adapter: reads frames from a <video> element via a canvas.
export function createVideoGrabber(
  video: HTMLVideoElement,
  createCanvas: () => CanvasLike,
): FrameGrabber {
  return {
    grab(): RawFrame {
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        throw new Error(t('camera.errors.notReady'));
      }
      const canvas = createCanvas();
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (context === null) {
        throw new Error(t('camera.errors.noCanvas'));
      }
      context.drawImage(video, 0, 0);
      return context.getImageData(0, 0, canvas.width, canvas.height);
    },

    // Waits for the next video frame. The timer is always armed: hidden or stalled videos
    // report no new frame, and the capture must not hang forever then.
    nextFrame(): Promise<void> {
      return new Promise((resolve) => {
        const timer = setTimeout(resolve, FALLBACK_FRAME_MS);
        if (typeof video.requestVideoFrameCallback === 'function') {
          video.requestVideoFrameCallback(() => {
            clearTimeout(timer);
            resolve();
          });
        }
      });
    },
  };
}
