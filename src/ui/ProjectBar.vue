<script setup lang="ts">
import { useProjectStore } from '../project/project-store';

// Nach jeder Aktion kann das Menü schließen; die Meldung steht in der Kopfzeile (ProjectStatus).
const emit = defineEmits<{ done: [] }>();
const project = useProjectStore();

function save(): void {
  project.save();
  emit('done');
}

async function onFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file !== undefined) {
    await project.load(await file.text());
    emit('done');
  }
  // Dieselbe Datei soll sich erneut wählen lassen.
  input.value = '';
}
</script>

<template>
  <section class="space-y-2" aria-labelledby="project-heading">
    <h2 id="project-heading" class="text-sm font-semibold">Projekt</h2>
    <div class="flex flex-wrap items-center gap-2">
      <button
        type="button"
        class="rounded border px-3 py-1 text-sm"
        data-testid="project-save"
        @click="save"
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
    </div>
  </section>
</template>
