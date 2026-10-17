<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

import ProjectBar from './ProjectBar.vue';
import ReferencePanel from './ReferencePanel.vue';

const open = ref(false);

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
      class="absolute right-0 top-full z-20 mt-2 max-h-[80vh] w-[min(26rem,calc(100vw-1.5rem))] space-y-4 overflow-auto rounded border border-slate-300 bg-white p-4 shadow-lg"
      data-testid="settings-panel"
    >
      <ReferencePanel />
      <ProjectBar @done="open = false" />
    </div>
  </div>
</template>
