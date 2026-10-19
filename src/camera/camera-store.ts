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

// Die Tabs mit Kamerabild; jeder hat sein eigenes Standbild.
export type StillKey = 'gray' | 'color' | 'preview';
export type Stills = Partial<Record<StillKey, Frame>>;

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
  // Standbilder der Tabs, die gerade nicht angezeigt werden (je Tab eines).
  const parked = shallowRef<Stills>({});
  // Der Tab, zu dem das angezeigte Standbild gehört (der zuletzt besuchte Tab mit Kamerabild).
  const stillOwner = ref<StillKey>('gray');
  // Während die Kamera nach neuen Karten sucht, bleibt das bisherige Standbild des Tabs hier erhalten.
  // Endet die Suche ohne neues Standbild, kehrt es zurück.
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

  // Nach dem Ende der Kamera ohne neues Standbild gilt wieder das bisherige.
  function settle(): void {
    if (still.value === null && held.value !== null) {
      still.value = held.value;
    }
    held.value = null;
  }

  async function start(): Promise<void> {
    release();
    // Ein Kamerastart betrifft nur das Standbild des aktiven Tabs: Es weicht dem Livebild, bleibt aber
    // erhalten, bis ein neues Standbild aufgenommen ist.
    held.value = still.value ?? held.value;
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

  // Verwirft das Standbild des aktiven Tabs (auch das gehaltene).
  function clearStill(): void {
    still.value = null;
    held.value = null;
  }

  // Verwirft die Standbilder aller Tabs (Projekt laden).
  function discardStills(): void {
    still.value = null;
    held.value = null;
    parked.value = {};
  }

  // Wechsel zwischen zwei Tabs: Das Standbild von `from` wird abgelegt und das von `to` (falls
  // vorhanden) angezeigt, damit keiner sein Bild verliert.
  function swapStill(from: StillKey, to: StillKey): void {
    const committed = still.value ?? held.value;
    const { [to]: next, ...rest } = parked.value;
    parked.value = committed === null ? rest : { ...rest, [from]: committed };
    // Läuft die Kamera, sucht auch der neue Tab nach Karten: sein Standbild wird gehalten.
    const searching = status.value === 'live' || status.value === 'starting';
    held.value = searching ? (next ?? null) : null;
    still.value = searching ? null : (next ?? null);
    stillOwner.value = to;
  }

  // Alle Standbilder der Tabs (das angezeigte gehört zu `stillOwner`), etwa zum Speichern im Projekt.
  function allStills(): Stills {
    const own = still.value ?? held.value;
    return own === null ? { ...parked.value } : { ...parked.value, [stillOwner.value]: own };
  }

  // Stellt die Standbilder aller Tabs her; angezeigt wird das des aktuellen Besitzers.
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
      // Das neue Standbild ersetzt das gehaltene.
      held.value = null;
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
