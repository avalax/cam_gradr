import { defineStore } from 'pinia';
import { ref } from 'vue';

// Live preview setting: position of the split line (in percent of the width, original left).
export const usePreviewStore = defineStore('preview', () => {
  const split = ref(50);

  function setSplit(value: number): void {
    split.value = Math.min(Math.max(value, 0), 100);
  }

  return { split, setSplit };
});
