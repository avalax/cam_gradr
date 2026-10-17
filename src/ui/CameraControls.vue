<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed } from 'vue';

import { useCameraStore } from '../camera/camera-store';
import { RESOLUTIONS } from '../camera/types';

const store = useCameraStore();
const { devices, selectedDeviceId, resolution, status, actual } = storeToRefs(store);

const isStarting = computed(() => status.value === 'starting');

function keyOf(r: { width: number; height: number }): string {
  return `${String(r.width)}x${String(r.height)}`;
}

function onDevice(event: Event): void {
  const value = (event.target as HTMLSelectElement).value;
  void store.selectDevice(value === '' ? null : value);
}

function onResolution(event: Event): void {
  const key = (event.target as HTMLSelectElement).value;
  const next = RESOLUTIONS.find((r) => keyOf(r) === key);
  if (next !== undefined) {
    void store.selectResolution(next);
  }
}
</script>

<template>
  <section class="space-y-3">
    <p
      class="max-w-4xl rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
      role="note"
    >
      Hinweis: Bitte Auto-Belichtung und Auto-Weißabgleich der Kamera in der Kamera-Software
      festsetzen. Automatische Anpassungen verfälschen die Messung.
    </p>

    <div class="flex flex-wrap items-end gap-4">
      <label class="flex flex-col text-sm">
        Kamera
        <select
          class="rounded border p-1"
          :value="selectedDeviceId ?? ''"
          :disabled="isStarting"
          @change="onDevice"
        >
          <option value="">Standardkamera</option>
          <option v-for="device in devices" :key="device.id" :value="device.id">
            {{ device.label }}
          </option>
        </select>
      </label>

      <label class="flex flex-col text-sm">
        Auflösung
        <select
          class="rounded border p-1"
          :value="keyOf(resolution)"
          :disabled="isStarting"
          @change="onResolution"
        >
          <option v-for="r in RESOLUTIONS" :key="keyOf(r)" :value="keyOf(r)">
            {{ r.width }} × {{ r.height }}
          </option>
        </select>
      </label>
    </div>

    <p v-if="actual !== null" class="text-xs text-slate-600">
      Aktive Auflösung: {{ actual.width }} × {{ actual.height }}
    </p>
  </section>
</template>
