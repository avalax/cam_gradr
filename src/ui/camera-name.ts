import type { VideoDevice } from '../camera/types';
import { t } from '../lang';

// The name of a camera in the list; browsers hide the names until the camera was allowed once.
export function cameraName(device: VideoDevice, index: number): string {
  return device.label === '' ? t('camera.controls.unnamed', { number: index + 1 }) : device.label;
}
