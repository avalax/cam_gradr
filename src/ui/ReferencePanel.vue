<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';

import { BUNDLED_NAME, BUNDLED_SOURCE_URL } from '../reference/bundled';
import { useReferenceStore } from '../reference/reference-store';

const { t } = useI18n();
const references = useReferenceStore();
const { sets, selected, error, warning, lastSaved, lastRemoved } = storeToRefs(references);

async function onFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file !== undefined) {
    await references.importFile(file.name, await file.text());
  }
  // The same file should be selectable again.
  input.value = '';
}

function onSelect(event: Event): void {
  references.select((event.target as HTMLSelectElement).value);
}
</script>

<template>
  <div class="space-y-2">
    <p class="text-xs text-slate-600" data-testid="reference-source">
      {{ t('reference.panel.sourceBefore', { name: BUNDLED_NAME }) }}
      <a :href="BUNDLED_SOURCE_URL" class="underline" target="_blank" rel="noopener noreferrer"
        >bartneck.de</a
      >
      {{ t('reference.panel.sourceAfter') }}
    </p>
    <label class="flex flex-col text-sm">
      {{ t('reference.panel.activeSet') }}
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
    <label
      class="flex cursor-pointer flex-col gap-1 rounded-md border-[1.5px] border-dashed border-zinc-400 bg-zinc-50 p-2 text-sm text-zinc-600 focus-within:outline focus-within:outline-2"
    >
      {{ t('reference.panel.import') }}
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
        {{ t('reference.panel.delete') }}
      </button>
      <button
        type="button"
        class="rounded border px-3 py-1 text-sm"
        data-testid="reference-download"
        @click="references.downloadSelected()"
      >
        {{ t('reference.panel.download') }}
      </button>
    </div>
    <p
      v-if="selected !== null && lastSaved === selected.name"
      class="text-xs text-slate-600"
      data-testid="reference-saved"
    >
      {{ t('reference.panel.saved') }}
    </p>
    <p v-if="lastRemoved !== null" class="text-xs text-slate-600" data-testid="reference-removed">
      {{ t('reference.panel.removed', { name: lastRemoved }) }}
    </p>
    <p v-if="error !== null" class="text-sm text-red-700" role="alert">{{ error }}</p>
    <p v-if="warning !== null" class="text-sm text-amber-800" role="status">{{ warning }}</p>
  </div>
</template>
