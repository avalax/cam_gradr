import { describe, expect, it } from 'vitest';

import { stageState } from './stage-state';

describe('stageState', () => {
  it('names a still image first, then the live image, otherwise the camera is off', () => {
    expect(stageState(true, true)).toBe('still');
    expect(stageState(true, false)).toBe('still');
    expect(stageState(false, true)).toBe('live');
    expect(stageState(false, false)).toBe('off');
  });
});
