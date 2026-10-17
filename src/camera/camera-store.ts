import { defineStore } from 'pinia';
import { ref, shallowRef } from 'vue';

import { createBrowserCamera } from './browser-camera';
import { captureAveraged } from './capture';
import type { FrameGrabber } from './capture';
import { describeCameraError, toCameraError } from './camera-error';
import type { Frame } from './frame';
import { DEFAULT_RESOLUTION } from './types';
import type { CameraApi, CameraSession, Resolution, VideoDevice } from './types';

export type CameraStatus = 'idle' | 'starting' | 'live' | 'error';

const STILL_FRAME_COUNT = 8;

const holder: { api: CameraApi } = {
  api: createBrowserCamera(() => navigator.mediaDevices),
};

// Austauschpunkt für Tests und spätere Alternativen.
export function setCameraApi(next: CameraApi): void {
  holder.api = next;
}

export const useCameraStore = defineStore('camera', () => {
  const devices = ref<VideoDevice[]>([]);
  const selectedDeviceId = ref<string | null>(null);
  const resolution = ref<Resolution>(DEFAULT_RESOLUTION);
  const status = ref<CameraStatus>('idle');
  const errorMessage = ref<string | null>(null);
  const stream = shallowRef<MediaStream | null>(null);
  const actual = ref<Resolution | null>(null);
  const still = shallowRef<Frame | null>(null);
  // Nimmt im Livebild selbst ein Standbild auf, sobald die Karten erkannt sind.
  const autoDetect = ref(true);
  let session: CameraSession | null = null;

  function release(): void {
    if (session !== null) {
      holder.api.close(session);
      session = null;
    }
    stream.value = null;
    actual.value = null;
  }

  async function start(): Promise<void> {
    release();
    still.value = null;
    status.value = 'starting';
    errorMessage.value = null;
    try {
      session = await holder.api.open(selectedDeviceId.value, resolution.value);
      stream.value = session.stream;
      actual.value = { width: session.settings.width, height: session.settings.height };
      selectedDeviceId.value = session.settings.deviceId === '' ? null : session.settings.deviceId;
      // Gerätenamen sind erst nach erteilter Berechtigung verfügbar.
      devices.value = await holder.api.enumerate();
      status.value = 'live';
    } catch (error) {
      release();
      errorMessage.value = describeCameraError(toCameraError(error));
      status.value = 'error';
    }
  }

  function stop(): void {
    release();
    status.value = 'idle';
  }

  async function selectDevice(id: string | null): Promise<void> {
    selectedDeviceId.value = id;
    if (status.value === 'live') {
      await start();
    }
  }

  async function selectResolution(next: Resolution): Promise<void> {
    resolution.value = next;
    if (status.value === 'live') {
      await start();
    }
  }

  function clearStill(): void {
    still.value = null;
  }

  async function captureStill(grabber: FrameGrabber, count = STILL_FRAME_COUNT): Promise<void> {
    errorMessage.value = null;
    try {
      still.value = await captureAveraged(grabber, count);
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Aufnahme fehlgeschlagen.';
    }
  }

  return {
    devices,
    selectedDeviceId,
    resolution,
    status,
    errorMessage,
    stream,
    actual,
    still,
    autoDetect,
    start,
    stop,
    selectDevice,
    selectResolution,
    captureStill,
    clearStill,
  };
});
