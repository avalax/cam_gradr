import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import type { ComputedRef } from 'vue';

import { useCameraStore } from '../camera/camera-store';
import { useSolveStore } from '../solve/solve-store';

import { previewImage } from './image-size';

// What the preview shows (previewImage), from the stores: one rule for the preview itself, for the
// export, which takes its height from it, and for the card tabs, which keep the room of its look bar
// free under their image, so that the frame around the tabs is equally high on every tab.
export function usePreviewArea(): ComputedRef<{ shown: boolean; aspect: number }> {
  const camera = useCameraStore();
  const { model } = storeToRefs(useSolveStore());
  return computed(() =>
    previewImage({
      corrected: model.value !== null,
      live: camera.status === 'live',
      stills: camera.allStills(),
      actual: camera.actual,
    }),
  );
}
