<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { useLookStore } from '../look/look-store';
import { fileDialogs } from '../project/project-file';
import { useProjectStore } from '../project/project-store';

const { t } = useI18n();

// The message about saving and loading sits above the content (ProjectStatus).
const project = useProjectStore();
// The still images show what the camera sees; the file then contains camera images.
const withStills = ref(true);
// The imported look LUTs go along, so that the project also works in another browser; the file
// then contains the LUTs, which matters when passing it on. The checkbox shows as soon as one is
// imported.
const withLooks = ref(true);
const looks = useLookStore();
const anyLook = computed(() => looks.looks.length > 0);

async function save(): Promise<void> {
  await project.save({ withStills: withStills.value, withLooks: anyLook.value && withLooks.value });
}

// Where the browser has the system dialogs (Chrome, Edge), the file is chosen there instead of in
// the file input: only then can saving return to its folder. The click reaches the input from the
// label as well as from the keyboard.
async function choose(event: MouseEvent): Promise<void> {
  const dialogs = fileDialogs();
  if (dialogs !== null) {
    event.preventDefault();
    await project.open(dialogs);
  }
}

async function onFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file !== undefined) {
    await project.load(await file.text(), { name: file.name });
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
    <label v-if="anyLook" class="flex items-start gap-2 text-xs text-zinc-600">
      <input v-model="withLooks" type="checkbox" class="mt-0.5" data-testid="project-looks" />
      <span>{{ t('project.bar.looks') }}</span>
    </label>
    <div class="flex flex-wrap items-center gap-2">
      <button
        type="button"
        class="rounded border border-zinc-800 bg-white dark:bg-zinc-100 px-3 py-1 text-sm"
        data-testid="project-save"
        @click="save"
      >
        {{ t('project.bar.save') }}
      </button>
      <label
        class="cursor-pointer rounded border border-zinc-800 bg-white dark:bg-zinc-100 px-3 py-1 text-sm focus-within:outline focus-within:outline-2"
      >
        {{ t('project.bar.load') }}
        <input
          type="file"
          accept=".json,application/json"
          class="sr-only"
          data-testid="project-file"
          @click="choose"
          @change="onFile"
        />
      </label>
    </div>
  </div>
</template>
