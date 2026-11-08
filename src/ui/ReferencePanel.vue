<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useTemplateRef } from 'vue';
import { useI18n } from 'vue-i18n';

import { BUNDLED_NAME, BUNDLED_SOURCE_URL } from '../reference/bundled';
import { useReferenceStore } from '../reference/reference-store';

import { LINK_BUTTON, SELECT, TEXT_BUTTON } from './control-styles';

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

// Deleting the active set takes its button away (the bundled set that follows cannot be deleted):
// the focus goes to the select of the active set, which stays.
const select = useTemplateRef<HTMLSelectElement>('select');

function remove(name: string): void {
  select.value?.focus();
  void references.remove(name);
}
</script>

<template>
  <div class="space-y-3">
    <p class="text-xs text-zinc-600" data-testid="reference-source">
      {{ t('reference.panel.sourceBefore', { name: BUNDLED_NAME }) }}
      <a :href="BUNDLED_SOURCE_URL" :class="LINK_BUTTON" target="_blank" rel="noopener noreferrer"
        >bartneck.de</a
      >
      {{ t('reference.panel.sourceAfter') }}
    </p>
    <!-- Select and buttons as in the camera section; the file input hides behind its button, as in
         the export, so it speaks the language of the app instead of the browser's. -->
    <label class="flex flex-col gap-1 text-sm">
      {{ t('reference.panel.activeSet') }}
      <select
        ref="select"
        :class="SELECT"
        :value="selected?.name"
        data-testid="reference-select"
        @change="onSelect"
      >
        <option v-for="set in sets" :key="set.name" :value="set.name">
          {{ set.name }}
        </option>
      </select>
    </label>
    <div class="flex flex-wrap gap-2">
      <label :class="[TEXT_BUTTON, 'focus-ring-within']">
        {{ t('reference.panel.import') }}
        <input
          type="file"
          accept=".json,.csv,application/json,text/csv"
          class="sr-only"
          data-testid="reference-file"
          @change="onFile"
        />
      </label>
      <template v-if="selected !== null">
        <button
          v-if="selected.name !== BUNDLED_NAME"
          type="button"
          :class="TEXT_BUTTON"
          @click="remove(selected.name)"
        >
          {{ t('reference.panel.delete') }}
        </button>
        <button type="button" :class="TEXT_BUTTON" @click="references.downloadSelected()">
          {{ t('reference.panel.download') }}
        </button>
      </template>
    </div>
    <p
      v-if="selected !== null && lastSaved === selected.name"
      class="text-xs text-zinc-600"
      data-testid="reference-saved"
    >
      {{ t('reference.panel.saved') }}
    </p>
    <p v-if="lastRemoved !== null" class="text-xs text-zinc-600" data-testid="reference-removed">
      {{ t('reference.panel.removed', { name: lastRemoved }) }}
    </p>
    <p v-if="error !== null" class="text-sm text-red-700 dark:text-red-400" role="alert">
      {{ error }}
    </p>
    <p v-if="warning !== null" class="text-sm text-amber-800 dark:text-amber-300" role="status">
      {{ warning }}
    </p>
  </div>
</template>
