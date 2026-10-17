<script setup lang="ts">
import { storeToRefs } from 'pinia';

import { BUNDLED_NAME, BUNDLED_SOURCE_URL } from '../reference/bundled';
import { useReferenceStore } from '../reference/reference-store';

const references = useReferenceStore();
const { sets, selected, error, warning, lastSaved, lastRemoved } = storeToRefs(references);

async function onFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file !== undefined) {
    await references.importFile(file.name, await file.text());
  }
  // Dieselbe Datei soll sich erneut wählen lassen.
  input.value = '';
}

function onSelect(event: Event): void {
  references.select((event.target as HTMLSelectElement).value);
}
</script>

<template>
  <section class="space-y-2" aria-labelledby="reference-heading">
    <h2 id="reference-heading" class="text-sm font-semibold">Referenzwerte</h2>
    <p class="text-xs text-slate-600" data-testid="reference-source">
      Der mitgelieferte Satz „{{ BUNDLED_NAME }}“ stammt aus dem Blogbeitrag
      <a :href="BUNDLED_SOURCE_URL" class="underline" target="_blank" rel="noopener noreferrer"
        >bartneck.de</a
      >
      und ist keine Datei von Datacolor. Abweichungen zur eigenen Karte sind möglich. Er wird beim
      Start immer geladen; alle Sätze bleiben nur lokal im Browser.
    </p>
    <label class="flex flex-col text-sm">
      Aktiver Satz
      <select
        class="rounded border p-1"
        :value="selected?.name"
        data-testid="reference-select"
        @change="onSelect"
      >
        <option v-for="set in sets" :key="set.name" :value="set.name">
          {{ set.name }}
        </option>
      </select>
    </label>
    <label class="flex flex-col text-sm">
      Eigene Datei importieren (JSON oder CSV)
      <input
        type="file"
        accept=".json,.csv,application/json,text/csv"
        class="text-sm"
        data-testid="reference-file"
        @change="onFile"
      />
    </label>
    <div v-if="selected !== null" class="flex flex-wrap gap-2">
      <button
        v-if="selected.name !== BUNDLED_NAME"
        type="button"
        class="rounded border px-3 py-1 text-sm"
        @click="references.remove(selected.name)"
      >
        Satz löschen
      </button>
      <button
        type="button"
        class="rounded border px-3 py-1 text-sm"
        data-testid="reference-download"
        @click="references.downloadSelected()"
      >
        Satz herunterladen
      </button>
    </div>
    <p
      v-if="selected !== null && lastSaved === selected.name"
      class="text-xs text-slate-600"
      data-testid="reference-saved"
    >
      Lokal im Browser gespeichert.
    </p>
    <p v-if="lastRemoved !== null" class="text-xs text-slate-600" data-testid="reference-removed">
      Satz „{{ lastRemoved }}“ lokal gelöscht.
    </p>
    <p v-if="error !== null" class="text-sm text-red-700" role="alert">{{ error }}</p>
    <p v-if="warning !== null" class="text-sm text-amber-800" role="status">{{ warning }}</p>
  </section>
</template>
