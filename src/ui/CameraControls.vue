<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { useCameraStore } from '../camera/camera-store';
import { RESOLUTIONS } from '../camera/types';

const { t } = useI18n();
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

function onResolution(next: (typeof RESOLUTIONS)[number]): void {
  void store.selectResolution(next);
}
</script>

<template>
  <section class="space-y-3">
    <label class="flex flex-col gap-1 text-sm">
      {{ t('camera.controls.camera') }}
      <select
        class="rounded-md border border-zinc-400 bg-white dark:bg-zinc-100 p-1.5"
        :value="selectedDeviceId ?? ''"
        :disabled="isStarting"
        @change="onDevice"
      >
        <option value="">{{ t('camera.controls.defaultCamera') }}</option>
        <option v-for="device in devices" :key="device.id" :value="device.id">
          {{ device.label }}
        </option>
      </select>
    </label>
    <div class="flex flex-col gap-1 text-sm">
      <span id="resolution-label">{{ t('camera.controls.resolution') }}</span>
      <div role="radiogroup" aria-labelledby="resolution-label" class="flex flex-wrap gap-1.5">
        <button
          v-for="r in RESOLUTIONS"
          :key="keyOf(r)"
          type="button"
          role="radio"
          class="rounded-full border px-3 py-0.5 text-xs disabled:opacity-50"
          :class="
            keyOf(r) === keyOf(resolution)
              ? 'border-zinc-800 bg-zinc-800 text-zinc-50'
              : 'border-zinc-400 bg-white dark:bg-zinc-100 text-zinc-800'
          "
          :aria-checked="keyOf(r) === keyOf(resolution)"
          :disabled="isStarting"
          :data-resolution="keyOf(r)"
          @click="onResolution(r)"
        >
          {{ r.width }} × {{ r.height }}
        </button>
      </div>
      <p v-if="actual !== null" class="text-xs text-zinc-500">
        {{ t('camera.controls.actualResolution', { width: actual.width, height: actual.height }) }}
      </p>
    </div>
    <p
      class="flex gap-2 rounded-md border border-zinc-200 bg-zinc-100 p-2 text-xs leading-snug text-zinc-600"
      role="note"
    >
      <span
        aria-hidden="true"
        class="mt-0.5 grid size-3.5 shrink-0 place-items-center rounded-full border-[1.5px] border-zinc-500 text-[9px] font-bold"
        >i</span
      >
      <span>{{ t('camera.controls.autoHint') }}</span>
    </p>
  </section>
</template>
