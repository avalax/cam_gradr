import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';

import { fitColorModel } from './fit';
import type { ColorModel, FitInput, FitResult } from './fit';

// Result of the color calculation. The model is available for preview and export; the report (with
// the reference values) only exists after a calculation, not after loading a project.
export const useSolveStore = defineStore('solve', () => {
  const result = shallowRef<FitResult | null>(null);
  const model = shallowRef<ColorModel | null>(null);
  const error = ref<string | null>(null);
  // Whether the tone curve (contrast and gamma) is corrected too. One setting for the whole
  // application: preview, report and export all use the model computed with it.
  const tone = ref(true);
  // The last input without the tone setting: it allows recomputing when the setting changes.
  const lastInput = shallowRef<Omit<FitInput, 'tone'> | null>(null);
  const canChangeTone = computed(() => lastInput.value !== null);

  function run(input: Omit<FitInput, 'tone'>): void {
    try {
      result.value = fitColorModel({ ...input, tone: tone.value });
      model.value = result.value.model;
      error.value = null;
    } catch (error_) {
      result.value = null;
      model.value = null;
      // The calculation throws only Error objects with an understandable message.
      error.value = (error_ as Error).message;
    }
  }

  function compute(input: Omit<FitInput, 'tone'>): void {
    lastInput.value = input;
    run(input);
  }

  // Switches the tone correction on or off and recomputes the model if there is a calculation.
  function setTone(value: boolean): void {
    tone.value = value;
    if (lastInput.value !== null) {
      run(lastInput.value);
    }
  }

  // Adopts a saved model (from a project) without a report.
  function loadModel(next: ColorModel): void {
    lastInput.value = null;
    result.value = null;
    model.value = next;
    error.value = null;
  }

  function reset(): void {
    lastInput.value = null;
    result.value = null;
    model.value = null;
    error.value = null;
  }

  return { result, model, error, tone, canChangeTone, compute, setTone, loadModel, reset };
});
