import { defineStore } from 'pinia';
import { ref } from 'vue';

// What the preview shows left of the divider while a look LUT is chosen: the camera image or the
// correction without the look.
export type LeftSide = 'camera' | 'corrected';

export const FULL_STRENGTH = 100;

function percent(value: number): number {
  return Math.round(Math.min(Math.max(value, 0), FULL_STRENGTH));
}

// Live preview settings: position of the split line (in percent of the width, original left) and
// the look LUT laid over the correction, with its strength in percent.
export const usePreviewStore = defineStore('preview', () => {
  const split = ref(50);
  const look = ref<string | null>(null);
  const strength = ref(FULL_STRENGTH);
  const left = ref<LeftSide>('camera');

  function setSplit(value: number): void {
    split.value = Math.min(Math.max(value, 0), 100);
  }

  function setLook(name: string | null): void {
    look.value = name;
  }

  function setStrength(value: number): void {
    strength.value = percent(value);
  }

  function setLeft(side: LeftSide): void {
    left.value = side;
  }

  return { split, look, strength, left, setSplit, setLook, setStrength, setLeft };
});
