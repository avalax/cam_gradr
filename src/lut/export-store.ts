import { defineStore } from 'pinia';
import { ref } from 'vue';

import { DEFAULT_CUBE_SIZE } from './cube';
import type { CubeSize } from './cube';

// The settings of the export tab, kept in a store so that they survive a switch to another tab. The
// size of the LUT also goes into a project file; what the project file includes (still images, look
// LUTs) does not. Whether the look goes into the LUT is not a setting of its own: the export takes
// what the preview shows.
export const useExportStore = defineStore('export', () => {
  const size = ref<CubeSize>(DEFAULT_CUBE_SIZE);
  // The still images show what the camera sees; the file then contains camera images.
  const withStills = ref(true);
  // The imported look LUTs go along, so that the project also works in another browser; the file
  // then contains the LUTs, which matters when passing it on.
  const withLooks = ref(true);

  function setSize(next: CubeSize): void {
    size.value = next;
  }

  function setWithStills(next: boolean): void {
    withStills.value = next;
  }

  function setWithLooks(next: boolean): void {
    withLooks.value = next;
  }

  return { size, withStills, withLooks, setSize, setWithStills, setWithLooks };
});
