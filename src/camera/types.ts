export interface VideoDevice {
  id: string;
  label: string;
}

export interface Resolution {
  width: number;
  height: number;
}

export interface CameraSession {
  stream: MediaStream;
  settings: Resolution & { deviceId: string };
}

export interface CameraApi {
  enumerate: () => Promise<VideoDevice[]>;
  open: (deviceId: string | null, resolution: Resolution) => Promise<CameraSession>;
  close: (session: CameraSession) => void;
}

export const DEFAULT_RESOLUTION: Resolution = { width: 1280, height: 720 };

export const RESOLUTIONS: readonly Resolution[] = [
  { width: 640, height: 480 },
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
  { width: 3840, height: 2160 },
];
