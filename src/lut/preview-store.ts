import { defineStore } from 'pinia';
import { ref } from 'vue';

// Einstellung der Live-Vorschau: Lage der Trennlinie (in Prozent der Breite, links Original).
export const usePreviewStore = defineStore('preview', () => {
  const split = ref(50);

  function setSplit(value: number): void {
    split.value = Math.min(Math.max(value, 0), 100);
  }

  return { split, setSplit };
});
