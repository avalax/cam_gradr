<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';

import { useCameraStore } from './camera/camera-store';
import CameraTab from './ui/CameraTab.vue';
import ColorStep from './ui/ColorStep.vue';
import GrayStep from './ui/GrayStep.vue';
import PreviewTab from './ui/PreviewTab.vue';
import { APP_ID, APP_NAME } from './ui/app-info';

type TabKey = 'camera' | 'gray' | 'color' | 'preview';

const TABS: readonly { key: TabKey; label: string }[] = [
  { key: 'camera', label: 'Kamera' },
  { key: 'gray', label: 'Graukarten' },
  { key: 'color', label: 'Farbkarten' },
  { key: 'preview', label: 'Vorschau' },
];

const tab = ref<TabKey>('camera');
const camera = useCameraStore();

// Das Standbild darf zwischen den Tabs mitwandern. Beim direkten Wechsel zwischen Grau- und
// Farbkarten wird es verworfen (andere Karten, andere Eckpunkte).
watch(tab, (next, previous) => {
  const between =
    (next === 'gray' && previous === 'color') || (next === 'color' && previous === 'gray');
  if (between) {
    camera.clearStill();
  }
});

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

      <div role="tablist" aria-label="Bereiche" class="flex flex-wrap gap-2">
        <button
          v-for="entry in TABS"
          :id="`tab-${entry.key}`"
          :key="entry.key"
          type="button"
          role="tab"
          class="rounded border px-3 py-1 text-sm"
          :class="tab === entry.key ? 'bg-slate-800 text-white' : ''"
          :aria-selected="tab === entry.key"
          :aria-controls="`panel-${entry.key}`"
          @click="tab = entry.key"
        >
          {{ entry.label }}
        </button>
      </div>
    </header>

    <div :id="`panel-${tab}`" role="tabpanel" :aria-labelledby="`tab-${tab}`">
      <CameraTab v-if="tab === 'camera'" />
      <GrayStep v-else-if="tab === 'gray'" @continue="tab = 'color'" />
      <ColorStep v-else-if="tab === 'color'" />
      <PreviewTab v-else />
    </div>

    <footer class="text-xs text-slate-500">{{ APP_ID }}</footer>
  </main>
</template>
