import { defineStore } from 'pinia';
import { ref } from 'vue';

import { DEFAULT_CUBE_SIZE } from './cube';
import type { CubeSize } from './cube';

// The size of the exported LUT, kept in a store so that a project file can save it. Whether the look
// goes into the file is not a setting of its own: the export takes what the preview shows.
export const useExportStore = defineStore('export', () => {
  const size = ref<CubeSize>(DEFAULT_CUBE_SIZE);

  function setSize(next: CubeSize): void {
    size.value = next;
  }

  return { size, setSize };
});
