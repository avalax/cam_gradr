import { createVideoGrabber } from '../camera/video-grabber';
import type { Frame } from '../camera/frame';
import type { PixelGrid } from '../chart/types';

export const MEASURE_INTERVAL_MS = 250;
const RGBA_CHANNELS = 4;
const MAX_CODE = 255;

// Pixelraster eines gemittelten Standbilds (RGB, Werte 0..1).
export function frameGrid(frame: Frame): PixelGrid {
  return { width: frame.width, height: frame.height, data: frame.data, channels: 3, maxValue: 1 };
}

// Ein Messschritt der Live-Anzeige: nur wenn das Video läuft, schon ein Bild liefert und alle
// Eckpunkte gesetzt sind (direkt nach dem Einschalten hat das Video noch keine Größe).
export function measureTick(
  isActive: boolean,
  element: HTMLVideoElement | null,
  measure: (grid: PixelGrid) => void,
): void {
  if (isActive && element !== null && element.videoWidth > 0) {
    const frame = createVideoGrabber(element, () => document.createElement('canvas')).grab();
    measure({
      width: frame.width,
      height: frame.height,
      data: frame.data,
      channels: RGBA_CHANNELS,
      maxValue: MAX_CODE,
    });
  }
}
