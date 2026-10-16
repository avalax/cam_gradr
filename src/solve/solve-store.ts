import { defineStore } from 'pinia';
import { ref, shallowRef } from 'vue';

import { fitColorModel } from './fit';
import type { FitInput, FitResult } from './fit';

// Ergebnis der Farbberechnung (Modell und Fehlerbericht), von der Vorschau später weiterverwendet.
export const useSolveStore = defineStore('solve', () => {
  const result = shallowRef<FitResult | null>(null);
  const error = ref<string | null>(null);

  function compute(input: FitInput): void {
    try {
      result.value = fitColorModel(input);
      error.value = null;
    } catch (error_) {
      result.value = null;
      // Die Berechnung wirft ausschließlich Error-Objekte mit verständlicher Meldung.
      error.value = (error_ as Error).message;
    }
  }

  function reset(): void {
    result.value = null;
    error.value = null;
  }

  return { result, error, compute, reset };
});
