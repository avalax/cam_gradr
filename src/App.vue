<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';

import { useCameraStore } from './camera/camera-store';
import CameraPanel from './ui/CameraPanel.vue';
import GrayStep from './ui/GrayStep.vue';
import { APP_ID, APP_NAME } from './ui/app-info';

type StepKey = 'camera' | 'gray';

const STEPS: readonly { key: StepKey; label: string }[] = [
  { key: 'camera', label: 'Kamera' },
  { key: 'gray', label: 'Schritt 1: Graukarten' },
];

const step = ref<StepKey>('camera');
const camera = useCameraStore();

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
        v-for="entry in STEPS"
        :key="entry.key"
        type="button"
        class="rounded border px-3 py-1 text-sm"
        :class="step === entry.key ? 'bg-slate-800 text-white' : ''"
        :aria-current="step === entry.key ? 'step' : undefined"
        @click="step = entry.key"
      >
        {{ entry.label }}
      </button>
    </nav>

    <CameraPanel v-if="step === 'camera'" />
    <GrayStep v-else @continue="step = 'camera'" />

    <footer class="text-xs text-slate-500">{{ APP_ID }}</footer>
  </main>
</template>
