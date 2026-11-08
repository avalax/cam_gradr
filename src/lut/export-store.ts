import { defineStore } from 'pinia';
import { ref } from 'vue';

import { DEFAULT_CUBE_SIZE } from './cube';
import type { CubeSize } from './cube';

// What the export writes: the size of the LUT and whether the look LUT chosen in the preview goes
// into it. A project file saves the size, and the look part together with the look LUTs.
export const EXPORT_DEFAULTS = { size: DEFAULT_CUBE_SIZE, withLook: true } as const;

export const useExportStore = defineStore('export', () => {
  const size = ref<CubeSize>(EXPORT_DEFAULTS.size);
  const withLook = ref<boolean>(EXPORT_DEFAULTS.withLook);

  function setSize(next: CubeSize): void {
    size.value = next;
  }

  function setWithLook(next: boolean): void {
    withLook.value = next;
  }

  return { size, withLook, setSize, setWithLook };
});
