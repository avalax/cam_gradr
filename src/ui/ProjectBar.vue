<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { useLookStore } from '../look/look-store';
import { useExportStore } from '../lut/export-store';
import { fileDialogs } from '../project/project-file';
import { useProjectStore } from '../project/project-store';

import { TEXT_BUTTON } from './control-styles';

const { t } = useI18n();

// The message about saving and loading floats at the bottom of the page (ProjectStatus).
const project = useProjectStore();
// What the file includes is kept in the export store, so that it survives a switch to another tab.
// The checkbox for the look LUTs shows as soon as one is imported.
const settings = useExportStore();
const { withStills, withLooks } = storeToRefs(settings);
const looks = useLookStore();
const anyLook = computed(() => looks.looks.length > 0);

function checked(event: Event): boolean {
  return (event.target as HTMLInputElement).checked;
}

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
    await project.loadChosen(file);
  }
  // The same file should be selectable again.
  input.value = '';
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <label class="flex items-start gap-2 text-xs text-zinc-600">
      <input
        type="checkbox"
        class="mt-0.5 accent-emerald-700"
        :checked="withStills"
        data-testid="project-stills"
        @change="settings.setWithStills(checked($event))"
      />
      <span>{{ t('project.bar.stills') }}</span>
    </label>
    <label v-if="anyLook" class="flex items-start gap-2 text-xs text-zinc-600">
      <input
        type="checkbox"
        class="mt-0.5 accent-emerald-700"
        :checked="withLooks"
        data-testid="project-looks"
        @change="settings.setWithLooks(checked($event))"
      />
      <span>{{ t('project.bar.looks') }}</span>
    </label>
    <div class="flex flex-wrap items-center gap-2">
      <button type="button" :class="TEXT_BUTTON" data-testid="project-save" @click="save">
        {{ t('project.bar.save') }}
      </button>
      <label :class="[TEXT_BUTTON, 'focus-ring-within']">
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
