import { defineStore } from 'pinia';
import { ref, shallowRef } from 'vue';

import { fitColorModel } from './fit';
import type { ColorModel, FitInput, FitResult } from './fit';

// Result of the color calculation. The model is available for preview and export; the report (with
// the reference values) only exists after a calculation, not after loading a project. The name of
// the reference set the model was fitted with goes along with it: a project saves that name, not the
// set that happens to be active, so that a correction loaded without its set keeps naming it.
export const useSolveStore = defineStore('solve', () => {
  const result = shallowRef<FitResult | null>(null);
  const model = shallowRef<ColorModel | null>(null);
  const referenceName = ref<string | null>(null);
  const error = ref<string | null>(null);

  function compute(input: FitInput): void {
    try {
      result.value = fitColorModel(input);
      model.value = result.value.model;
      referenceName.value = input.reference.name;
      error.value = null;
    } catch (error_) {
      result.value = null;
      model.value = null;
      referenceName.value = null;
      // The calculation throws only Error objects with an understandable message.
      error.value = (error_ as Error).message;
    }
  }

  // Adopts a saved model (from a project) without a report, with the name of its reference set; null
  // means there is none.
  function loadModel(next: ColorModel | null, reference: string | null): void {
    result.value = null;
    model.value = next;
    referenceName.value = next === null ? null : reference;
    error.value = null;
  }

  return { result, model, referenceName, error, compute, loadModel };
});
