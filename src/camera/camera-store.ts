import { defineStore } from 'pinia';
import { ref, shallowRef } from 'vue';

import { t } from '../lang';

import { createBrowserCamera } from './browser-camera';
import { captureAveraged } from './capture';
import type { FrameGrabber } from './capture';
import { describeCameraError, toCameraError } from './camera-error';
import type { Frame } from './frame';
import { DEFAULT_RESOLUTION } from './types';
import type { CameraApi, CameraSession, Resolution, VideoDevice } from './types';

export type CameraStatus = 'idle' | 'starting' | 'live' | 'error';

// The tabs with a camera image; each has its own still image.
export type StillKey = 'gray' | 'color' | 'preview';
export type Stills = Partial<Record<StillKey, Frame>>;

const STILL_FRAME_COUNT = 8;

const holder: { api: CameraApi } = {
  api: createBrowserCamera(() => navigator.mediaDevices),
};

// Swap point for tests and later alternatives.
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
  // Still images of the tabs that are not currently shown (one per tab).
  const parked = shallowRef<Stills>({});
  // The tab the shown still image belongs to (the last visited tab with a camera image).
  const stillOwner = ref<StillKey>('gray');
  // While the camera searches for new charts, the tab's previous still image is kept here.
  // If the search ends without a new still image, it comes back.
  const held = shallowRef<Frame | null>(null);
  let session: CameraSession | null = null;

  function release(): void {
    if (session !== null) {
      holder.api.close(session);
      session = null;
    }
    stream.value = null;
    actual.value = null;
  }

  // After the camera ends without a new still image, the previous one applies again.
  function settle(): void {
    if (still.value === null && held.value !== null) {
      still.value = held.value;
    }
    held.value = null;
  }

  async function start(): Promise<void> {
    release();
    // Starting the camera only affects the active tab's still image: it yields to the live image
    // but is kept until a new still image has been captured.
    held.value = still.value ?? held.value;
    still.value = null;
    status.value = 'starting';
    errorMessage.value = null;
    try {
      session = await holder.api.open(selectedDeviceId.value, resolution.value);
      stream.value = session.stream;
      actual.value = { width: session.settings.width, height: session.settings.height };
      selectedDeviceId.value = session.settings.deviceId === '' ? null : session.settings.deviceId;
      // Device names are only available once permission has been granted.
      devices.value = await holder.api.enumerate();
      status.value = 'live';
    } catch (error) {
      release();
      errorMessage.value = describeCameraError(toCameraError(error));
      status.value = 'error';
      settle();
    }
  }

  function stop(): void {
    release();
    status.value = 'idle';
    settle();
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

  // Discards the active tab's still image (including the held one).
  function clearStill(): void {
    still.value = null;
    held.value = null;
  }

  // Discards the still images of all tabs (loading a project).
  function discardStills(): void {
    still.value = null;
    held.value = null;
    parked.value = {};
  }

  // Switching between two tabs: the still image of `from` is stored and that of `to` (if
  // present) is shown, so that no tab loses its image.
  function swapStill(from: StillKey, to: StillKey): void {
    const committed = still.value ?? held.value;
    const { [to]: next, ...rest } = parked.value;
    parked.value = committed === null ? rest : { ...rest, [from]: committed };
    // If the camera is running, the new tab also searches for charts: its still image is held.
    const searching = status.value === 'live' || status.value === 'starting';
    held.value = searching ? (next ?? null) : null;
    still.value = searching ? null : (next ?? null);
    stillOwner.value = to;
  }

  // All still images of the tabs (the shown one belongs to `stillOwner`), e.g. for saving.
  function allStills(): Stills {
    const own = still.value ?? held.value;
    return own === null ? { ...parked.value } : { ...parked.value, [stillOwner.value]: own };
  }

  // Restores the still images of all tabs; the current owner's image is the one shown.
  function restoreStills(frames: Stills): void {
    const { [stillOwner.value]: current, ...rest } = frames;
    held.value = null;
    still.value = current ?? null;
    parked.value = rest;
  }

  async function captureStill(grabber: FrameGrabber, count = STILL_FRAME_COUNT): Promise<void> {
    errorMessage.value = null;
    try {
      still.value = await captureAveraged(grabber, count);
      // The new still image replaces the held one.
      held.value = null;
    } catch (error) {
      errorMessage.value =
        error instanceof Error ? error.message : t('camera.errors.captureFailed');
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
    start,
    stop,
    selectDevice,
    selectResolution,
    captureStill,
    clearStill,
    discardStills,
    stillOwner,
    swapStill,
    allStills,
    restoreStills,
  };
});
