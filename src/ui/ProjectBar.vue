<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { useProjectStore } from '../project/project-store';

const { t } = useI18n();

// The message about saving and loading sits above the content (ProjectStatus).
const project = useProjectStore();
// The still images show what the camera sees; the file then contains camera images.
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
  // The same file should be selectable again.
  input.value = '';
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <label class="flex items-start gap-2 text-xs text-zinc-600">
      <input v-model="withStills" type="checkbox" class="mt-0.5" data-testid="project-stills" />
      <span>{{ t('project.bar.stills') }}</span>
    </label>
    <div class="flex flex-wrap items-center gap-2">
      <button
        type="button"
        class="rounded border border-zinc-800 bg-white px-3 py-1 text-sm"
        data-testid="project-save"
        @click="save"
      >
        {{ t('project.bar.save') }}
      </button>
      <label
        class="cursor-pointer rounded border border-zinc-800 bg-white px-3 py-1 text-sm focus-within:outline focus-within:outline-2"
      >
        {{ t('project.bar.load') }}
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
