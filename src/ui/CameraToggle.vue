<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { useCameraStore } from '../camera/camera-store';

const { t } = useI18n();
const camera = useCameraStore();
const { status } = storeToRefs(camera);

// "On" while the camera starts or runs. After an error it is off, as the image says: a click starts
// it again. The error itself is shown in the image area of the tab, not here.
const isOn = computed(() => status.value === 'live' || status.value === 'starting');
const label = computed(() => {
  if (status.value === 'starting') {
    return t('camera.toggle.starting');
  }
  return t(isOn.value ? 'camera.toggle.stop' : 'camera.toggle.start');
});

// Green to start, yellow while starting, red to stop.
const buttonClass = computed(() => {
  if (status.value === 'starting') {
    return 'border-amber-500 bg-amber-400 text-zinc-950 hover:bg-amber-500';
  }
  return isOn.value
    ? 'border-red-700 bg-red-700 text-white hover:bg-red-800'
    : 'border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800';
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
  <button
    type="button"
    role="switch"
    :aria-label="t('camera.toggle.label')"
    class="rounded border px-3 py-1 text-sm"
    :class="buttonClass"
    :aria-checked="isOn"
    :data-status="status"
    data-testid="camera-toggle"
    @click="toggle"
  >
    {{ label }}
  </button>
</template>
