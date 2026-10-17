import { defineStore } from 'pinia';
import { ref, shallowRef } from 'vue';

import { fitColorModel } from './fit';
import type { ColorModel, FitInput, FitResult } from './fit';

// Ergebnis der Farbberechnung. Das Modell steht für Vorschau und Export bereit; der Bericht (mit den
// Referenzwerten) gibt es nur nach einer Berechnung, nicht nach dem Laden eines Projekts.
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
      // Die Berechnung wirft ausschließlich Error-Objekte mit verständlicher Meldung.
      error.value = (error_ as Error).message;
    }
  }

  // Übernimmt ein gespeichertes Modell (aus einem Projekt) ohne Bericht.
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
