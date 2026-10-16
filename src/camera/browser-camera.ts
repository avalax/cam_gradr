import { CameraError, toCameraError } from './camera-error';
import type { CameraApi, CameraSession, Resolution, VideoDevice } from './types';

export type MediaApi = Pick<MediaDevices, 'enumerateDevices' | 'getUserMedia'>;

function requireMedia(media: MediaApi | undefined): MediaApi {
  if (media === undefined) {
    throw new CameraError('unsupported');
  }
  return media;
}

// Dünner Adapter um die Browser-Kamera-API; die Medien-API ist für Tests austauschbar.
export function createBrowserCamera(getMedia: () => MediaApi | undefined): CameraApi {
  return {
    async enumerate(): Promise<VideoDevice[]> {
      try {
        const devices = await requireMedia(getMedia()).enumerateDevices();
        return devices
          .filter((device) => device.kind === 'videoinput')
          .map((device, index) => ({
            id: device.deviceId,
            label: device.label === '' ? `Kamera ${String(index + 1)}` : device.label,
          }));
      } catch (error) {
        throw toCameraError(error);
      }
    },

    async open(deviceId: string | null, resolution: Resolution): Promise<CameraSession> {
      try {
        const stream = await requireMedia(getMedia()).getUserMedia({
          audio: false,
          video: {
            ...(deviceId !== null && { deviceId: { exact: deviceId } }),
            width: { ideal: resolution.width },
            height: { ideal: resolution.height },
          },
        });
        const settings = stream.getVideoTracks()[0]?.getSettings() ?? {};
        return {
          stream,
          settings: {
            width: settings.width ?? resolution.width,
            height: settings.height ?? resolution.height,
            deviceId: settings.deviceId ?? deviceId ?? '',
          },
        };
      } catch (error) {
        throw toCameraError(error);
      }
    },

    close(session: CameraSession): void {
      for (const track of session.stream.getTracks()) {
        track.stop();
      }
    },
  };
}
