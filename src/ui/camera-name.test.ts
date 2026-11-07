import { describe, expect, it } from 'vitest';

import { cameraName } from './camera-name';

describe('cameraName', () => {
  it('keeps the name of the browser and numbers a camera without one', () => {
    expect(cameraName({ id: 'a', label: 'Webcam' }, 0)).toBe('Webcam');
    expect(cameraName({ id: 'b', label: '' }, 1)).toBe('Kamera 2');
  });
});
