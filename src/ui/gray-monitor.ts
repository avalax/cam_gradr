import { createVideoGrabber } from '../camera/video-grabber';
import type { PixelGrid } from '../chart/types';

export const MEASURE_INTERVAL_MS = 250;
const RGBA_CHANNELS = 4;
const MAX_CODE = 255;

// Ein Messschritt der Live-Anzeige: nur wenn das Video läuft und alle Eckpunkte gesetzt sind.
export function measureTick(
  isActive: boolean,
  element: HTMLVideoElement | null,
  measure: (grid: PixelGrid) => void,
): void {
  if (isActive && element !== null) {
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
