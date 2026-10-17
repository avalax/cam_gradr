import { defineStore } from 'pinia';
import { ref } from 'vue';

// Einstellungen der Live-Vorschau: Stärke der Korrektur und Lage der Trennlinie (in Prozent).
export const usePreviewStore = defineStore('preview', () => {
  const strength = ref(100);
  const split = ref(50);

  function setStrength(value: number): void {
    strength.value = Math.min(Math.max(value, 0), 100);
  }

  function setSplit(value: number): void {
    split.value = Math.min(Math.max(value, 0), 100);
  }

  return { strength, split, setStrength, setSplit };
});
