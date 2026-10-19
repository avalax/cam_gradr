<script setup lang="ts">
import { ref } from 'vue';

import { useProjectStore } from '../project/project-store';

// Die Meldung zu Speichern und Laden steht über dem Inhalt (ProjectStatus).
const project = useProjectStore();
// Die Standbilder zeigen, was die Kamera sieht; die Datei enthält dann Kamerabilder.
const withStills = ref(true);

async function save(): Promise<void> {
  await project.save({ withStills: withStills.value });
}

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
  <div class="flex flex-col gap-2">
    <label class="flex items-start gap-2 text-xs text-zinc-600">
      <input v-model="withStills" type="checkbox" class="mt-0.5" data-testid="project-stills" />
      <span>Standbilder mitspeichern (die Datei enthält dann Kamerabilder)</span>
    </label>
    <div class="flex flex-wrap items-center gap-2">
      <button
        type="button"
        class="rounded border border-zinc-800 bg-white px-3 py-1 text-sm"
        data-testid="project-save"
        @click="save"
      >
        Projekt speichern
      </button>
      <label
        class="cursor-pointer rounded border border-zinc-800 bg-white px-3 py-1 text-sm focus-within:outline focus-within:outline-2"
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
    </div>
  </div>
</template>
