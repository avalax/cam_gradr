<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed } from 'vue';

import { useCameraStore } from '../camera/camera-store';

const camera = useCameraStore();
const { status, errorMessage } = storeToRefs(camera);

// "An" gilt auch während des Startens oder bei einem Fehler: ein Klick schaltet dann aus.
const isOn = computed(() => status.value !== 'idle');
const label = computed(() => {
  if (status.value === 'starting') {
    return 'Kamera startet …';
  }
  return isOn.value ? 'Kamera stoppen' : 'Kamera starten';
});

function toggle(): void {
  if (isOn.value) {
    camera.stop();
  } else {
    void camera.start();
  }
}
</script>

<template>
  <div class="flex items-center gap-2">
    <button
      type="button"
      role="switch"
      aria-label="Kamera"
      class="rounded border px-3 py-1 text-sm"
      :class="
        isOn
          ? 'border-red-700 bg-red-700 text-white'
          : 'border-emerald-700 bg-emerald-700 text-white'
      "
      :aria-checked="isOn"
      :data-status="status"
      data-testid="camera-toggle"
      @click="toggle"
    >
      {{ label }}
    </button>
    <p v-if="status === 'error'" class="text-sm text-red-700" role="alert">{{ errorMessage }}</p>
  </div>
</template>
