import { defineStore } from 'pinia';
import { ref, shallowRef } from 'vue';

import { fitColorModel } from './fit';
import type { ColorModel, FitInput, FitResult } from './fit';

// Result of the color calculation. The model is available for preview and export; the report (with
// the reference values) only exists after a calculation, not after loading a project.
export const useSolveStore = defineStore('solve', () => {
  const result = shallowRef<FitResult | null>(null);
  const model = shallowRef<ColorModel | null>(null);
  const error = ref<string | null>(null);

  function compute(input: FitInput): void {
    try {
      result.value = fitColorModel(input);
      model.value = result.value.model;
      error.value = null;
    } catch (error_) {
      result.value = null;
      model.value = null;
      // The calculation throws only Error objects with an understandable message.
      error.value = (error_ as Error).message;
    }
  }

  // Adopts a saved model (from a project) without a report.
  function loadModel(next: ColorModel): void {
    result.value = null;
    model.value = next;
    error.value = null;
  }

  function reset(): void {
    result.value = null;
    model.value = null;
    error.value = null;
  }

  return { result, model, error, compute, loadModel, reset };
});
