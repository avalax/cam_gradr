import { defineStore } from 'pinia';
import { ref } from 'vue';

// What a side of the preview starts from while a look LUT is chosen: the camera image or the
// corrected one. The left side shows it as it is, the right side lays the look over it.
export type Side = 'camera' | 'corrected';

export const FULL_STRENGTH = 100;

// The look settings without any look LUT: what a project saved without look LUTs restores.
export const LOOK_DEFAULTS = {
  look: null,
  strength: FULL_STRENGTH,
  left: 'camera',
  right: 'corrected',
} as const;

function percent(value: number): number {
  return Math.round(Math.min(Math.max(value, 0), FULL_STRENGTH));
}

// Live preview settings: position of the split line (in percent of the width, original left), the
// look LUT with its strength in percent, and what both sides start from.
export const usePreviewStore = defineStore('preview', () => {
  const split = ref(50);
  const look = ref<string | null>(LOOK_DEFAULTS.look);
  const strength = ref<number>(LOOK_DEFAULTS.strength);
  const left = ref<Side>(LOOK_DEFAULTS.left);
  const right = ref<Side>(LOOK_DEFAULTS.right);

  function setSplit(value: number): void {
    split.value = Math.min(Math.max(value, 0), 100);
  }

  function setLook(name: string | null): void {
    look.value = name;
  }

  function setStrength(value: number): void {
    strength.value = percent(value);
  }

  function setLeft(side: Side): void {
    left.value = side;
  }

  function setRight(side: Side): void {
    right.value = side;
  }

  return { split, look, strength, left, right, setSplit, setLook, setStrength, setLeft, setRight };
});
