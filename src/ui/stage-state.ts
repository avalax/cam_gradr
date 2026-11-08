// What the image of a tab shows: nothing yet (the camera is off), the live image or a still image.
// A still image counts first: after a capture the camera may still be running for a moment.
export type StageState = 'off' | 'live' | 'still';

export function stageState(still: boolean, live: boolean): StageState {
  if (still) {
    return 'still';
  }
  return live ? 'live' : 'off';
}
