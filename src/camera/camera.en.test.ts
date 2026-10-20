import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { setLocale } from '../lang';

import { CameraError, describeCameraError } from './camera-error';
import { useCameraStore } from './camera-store';

describe('camera texts in English', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    setLocale('en');
  });

  it.each([
    ['unsupported', 'Camera access is not supported'],
    ['permission-denied', 'Access to the camera was denied'],
    ['not-found', 'No camera was found.'],
    ['in-use', 'The camera is already in use'],
    ['unsatisfiable', 'does not support the requested resolution'],
    ['unknown', 'The camera could not be started.'],
  ] as const)('describes %s in English', (code, text) => {
    expect(describeCameraError(new CameraError(code))).toContain(text);
  });

  it('uses an English fallback when a capture fails without a message', async () => {
    const failing = {
      grab: () => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'broken';
      },
      nextFrame: () => Promise.resolve(),
    };
    const store = useCameraStore();
    await store.captureStill(failing, 1);
    expect(store.errorMessage).toBe('Capture failed.');
  });
});
