<script setup lang="ts">
import { storeToRefs } from 'pinia';

import { useProjectStore } from '../project/project-store';

const project = useProjectStore();
const { error, notice } = storeToRefs(project);

async function onFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file !== undefined) {
    await project.load(await file.text());
  }
  // Dieselbe Datei soll sich erneut wählen lassen.
  input.value = '';
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <button
      type="button"
      class="rounded border px-3 py-1 text-sm"
      data-testid="project-save"
      @click="project.save()"
    >
      Projekt speichern
    </button>
    <label
      class="cursor-pointer rounded border px-3 py-1 text-sm focus-within:outline focus-within:outline-2"
    >
      Projekt laden
      <input
        type="file"
        accept=".json,application/json"
        class="sr-only"
        data-testid="project-file"
        @change="onFile"
      />
    </label>
    <p
      v-if="error !== null"
      class="w-full text-sm text-red-700"
      role="alert"
      data-testid="project-error"
    >
      {{ error }}
    </p>
    <p
      v-if="notice !== null"
      class="w-full text-sm text-slate-700"
      role="status"
      data-testid="project-notice"
    >
      {{ notice }}
    </p>
  </div>
</template>
