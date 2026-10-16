<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';

import { useCameraStore } from './camera/camera-store';
import GrayStep from './ui/GrayStep.vue';
import { APP_ID, APP_NAME } from './ui/app-info';

type StepKey = 'gray' | 'color';

const step = ref<StepKey>('gray');
const colorUnlocked = ref(false);
const camera = useCameraStore();

function toColorStep(): void {
  colorUnlocked.value = true;
  step.value = 'color';
}

onBeforeUnmount(() => {
  camera.stop();
});
</script>

<template>
  <main class="mx-auto max-w-5xl space-y-4 p-6">
    <h1 class="text-2xl font-semibold">{{ APP_NAME }}</h1>
    <p class="text-slate-600">Webcam-LUT-Generator für die Spyder Checkr Photo.</p>

    <nav aria-label="Schritte" class="flex flex-wrap gap-2">
      <button
        type="button"
        class="rounded border px-3 py-1 text-sm"
        :class="step === 'gray' ? 'bg-slate-800 text-white' : ''"
        :aria-current="step === 'gray' ? 'step' : undefined"
        @click="step = 'gray'"
      >
        Schritt 1: Graukarten
      </button>
      <button
        type="button"
        class="rounded border px-3 py-1 text-sm disabled:opacity-50"
        :class="step === 'color' ? 'bg-slate-800 text-white' : ''"
        :aria-current="step === 'color' ? 'step' : undefined"
        :disabled="!colorUnlocked"
        @click="step = 'color'"
      >
        Schritt 2: Farbkarten
      </button>
    </nav>

    <GrayStep v-if="step === 'gray'" @continue="toColorStep" />
    <p v-else class="text-sm text-slate-700">
      Schritt 2 (Farbkarten, Referenz-Import und LUT-Berechnung) folgt.
    </p>

    <footer class="text-xs text-slate-500">{{ APP_ID }}</footer>
  </main>
</template>
