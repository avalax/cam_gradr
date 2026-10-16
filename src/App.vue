<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';

import { useCameraStore } from './camera/camera-store';
import ColorStep from './ui/ColorStep.vue';
import GrayStep from './ui/GrayStep.vue';
import { APP_ID, APP_NAME } from './ui/app-info';

type StepKey = 'gray' | 'color';

const step = ref<StepKey>('gray');
const colorUnlocked = ref(false);
const camera = useCameraStore();

// Ein Standbild gehört zu genau einem Schritt (andere Karten, andere Eckpunkte).
watch(step, () => {
  camera.clearStill();
});

function toColorStep(): void {
  colorUnlocked.value = true;
  step.value = 'color';
}

onBeforeUnmount(() => {
  camera.stop();
});
</script>

<template>
  <main class="w-full space-y-3 p-3 md:px-6 md:py-4">
    <header class="flex flex-wrap items-center gap-x-6 gap-y-2">
      <div class="flex items-baseline gap-3">
        <h1 class="text-xl font-semibold">{{ APP_NAME }}</h1>
        <p class="text-sm text-slate-600">Webcam-LUT-Generator für die Spyder Checkr Photo.</p>
      </div>

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
    </header>

    <GrayStep v-if="step === 'gray'" @continue="toColorStep" />
    <ColorStep v-else />

    <footer class="text-xs text-slate-500">{{ APP_ID }}</footer>
  </main>
</template>
