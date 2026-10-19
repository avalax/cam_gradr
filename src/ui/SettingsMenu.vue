<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { useCameraStore } from '../camera/camera-store';
import { useReferenceStore } from '../reference/reference-store';

import CameraControls from './CameraControls.vue';
import ReferencePanel from './ReferencePanel.vue';

type Section = 'camera' | 'reference';

const open = ref(false);
// Aufgeklappter Abschnitt; zugeklappt steht rechts eine Kurzfassung des Stands.
const section = ref<Section | null>('camera');

function toggle(next: Section): void {
  section.value = section.value === next ? null : next;
}

const { devices, selectedDeviceId, resolution, actual } = storeToRefs(useCameraStore());
const { selected } = storeToRefs(useReferenceStore());

const cameraSummary = computed(() => {
  const device = devices.value.find((entry) => entry.id === selectedDeviceId.value);
  const size = actual.value ?? resolution.value;
  return `${device?.label ?? 'Standardkamera'} · ${String(size.width)} × ${String(size.height)}`;
});
const referenceSummary = computed(() => selected.value?.name ?? 'Mitgelieferter Satz');

function onPointerDown(event: PointerEvent): void {
  // Ein Klick außerhalb des Menüs schließt es.
  if (open.value && (event.target as Element).closest('[data-settings-root]') === null) {
    open.value = false;
  }
}

function onKeyDown(event: KeyboardEvent): void {
  if (open.value && event.key === 'Escape') {
    open.value = false;
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('keydown', onKeyDown);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown);
  document.removeEventListener('keydown', onKeyDown);
});
</script>

<template>
  <div class="relative" data-settings-root>
    <button
      type="button"
      class="rounded border px-2 py-1 text-lg leading-none"
      aria-label="Einstellungen"
      aria-haspopup="dialog"
      :aria-expanded="open"
      title="Einstellungen"
      data-testid="settings-button"
      @click="open = !open"
    >
      <span aria-hidden="true">⚙</span>
    </button>
    <div
      v-if="open"
      role="dialog"
      aria-label="Einstellungen"
      class="absolute right-0 top-full z-20 mt-2 max-h-[80vh] w-[min(26rem,calc(100vw-1.5rem))] overflow-auto rounded-lg border border-zinc-400 bg-white shadow-lg"
      data-testid="settings-panel"
    >
      <section aria-labelledby="camera-heading">
        <h2 id="camera-heading">
          <button
            type="button"
            class="flex w-full items-center gap-2 px-3 py-2.5 text-left"
            :aria-expanded="section === 'camera'"
            aria-controls="camera-body"
            data-testid="section-camera"
            @click="toggle('camera')"
          >
            <span class="text-sm font-semibold">Kamera</span>
            <small class="ml-auto truncate text-[11px] font-normal text-zinc-500">{{
              cameraSummary
            }}</small>
            <span aria-hidden="true" class="text-zinc-500">{{
              section === 'camera' ? '⌃' : '⌄'
            }}</span>
          </button>
        </h2>
        <div v-if="section === 'camera'" id="camera-body" class="px-3 pb-3">
          <CameraControls />
        </div>
      </section>
      <section class="border-t border-zinc-200" aria-labelledby="reference-heading">
        <h2 id="reference-heading">
          <button
            type="button"
            class="flex w-full items-center gap-2 px-3 py-2.5 text-left"
            :aria-expanded="section === 'reference'"
            aria-controls="reference-body"
            data-testid="section-reference"
            @click="toggle('reference')"
          >
            <span class="text-sm font-semibold">Referenzwerte</span>
            <small class="ml-auto truncate text-[11px] font-normal text-zinc-500">{{
              referenceSummary
            }}</small>
            <span aria-hidden="true" class="text-zinc-500">{{
              section === 'reference' ? '⌃' : '⌄'
            }}</span>
          </button>
        </h2>
        <div v-if="section === 'reference'" id="reference-body" class="px-3 pb-3">
          <ReferencePanel />
        </div>
      </section>
    </div>
  </div>
</template>
