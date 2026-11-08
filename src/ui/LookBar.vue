<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, useTemplateRef } from 'vue';
import { useI18n } from 'vue-i18n';

import { useLookStore } from '../look/look-store';
import type { LookMessage } from '../look/look-store';
import { usePreviewStore } from '../lut/preview-store';

import { LINK_BUTTON } from './control-styles';
import { focusById } from './focus';
import IconButton from './IconButton.vue';
import { TRASH_PATH } from './icons';
import LookPicker from './LookPicker.vue';

const { t } = useI18n();
const looks = useLookStore();
const preview = usePreviewStore();
const { looks: list, messages } = storeToRefs(looks);
const { strength } = storeToRefs(preview);

const file = useTemplateRef<HTMLInputElement>('file');
const current = computed(() => looks.find(preview.look));
const strengthText = computed(() =>
  current.value === null ? '–' : t('look.percent', { value: strength.value }),
);

const names = computed(() => list.value.map((look) => look.name));
// The look chosen in the list; every change applies at once and clears the last messages.
const chosen = computed({
  get: () => current.value?.name ?? null,
  set: (name: string | null) => {
    looks.dismiss();
    preview.setLook(name);
  },
});

async function onFiles(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const chosen = [...(input.files ?? [])];
  // The same files should be selectable again.
  input.value = '';
  await looks.importFiles(chosen.map((entry) => ({ name: entry.name, text: () => entry.text() })));
}

// Deleting a look or undoing it removes the button that did it (the trash goes with the chosen look,
// the message with its link is replaced): the focus goes to the picker, which stays.
const PICKER_ID = 'look-select';

function remove(name: string): void {
  focusById(PICKER_ID);
  void looks.remove(name);
}

function undo(): void {
  focusById(PICKER_ID);
  void looks.undo();
}

function onStrength(event: Event): void {
  preview.setStrength(Number((event.target as HTMLInputElement).value));
}

function text(message: LookMessage): string {
  switch (message.kind) {
    case 'imported': {
      return message.names.length === 1
        ? t('look.messages.importedOne', { name: message.names[0] })
        : t('look.messages.importedMany', { count: message.names.length });
    }
    case 'rejected': {
      return t('look.messages.rejected', { file: message.file, reason: message.reason });
    }
    case 'logConversion': {
      return t('look.messages.logConversion', { name: message.name });
    }
    case 'removed': {
      return t('look.messages.removed', { name: message.name });
    }
    case 'saveFailed': {
      return t('look.messages.saveFailed', { name: message.name });
    }
    default: {
      return t(`look.messages.${message.kind}`);
    }
  }
}
</script>

<template>
  <!-- The look LUT under the preview: choose or import in one list, delete only the chosen one,
       strength. What the sides of the divider show is switched by a click on their labels. -->
  <div
    class="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-b border-t-(length:--band-line) border-zinc-700 bg-zinc-200 px-2.5 py-2 text-xs text-zinc-800"
    role="group"
    :aria-label="t('look.label')"
    data-testid="look-bar"
  >
    <div class="flex min-w-0 items-center gap-1.5">
      <label :for="PICKER_ID" class="font-semibold">{{ t('look.label') }}</label>
      <LookPicker
        v-model="chosen"
        :names="names"
        :none-text="t(list.length === 0 ? 'look.empty' : 'look.none')"
        :import-text="t('look.import')"
        @import="file?.click()"
      />
      <input
        ref="file"
        type="file"
        accept=".cube"
        multiple
        class="sr-only"
        tabindex="-1"
        :aria-label="t('look.importFile')"
        data-testid="look-file"
        @change="onFiles"
      />
      <!-- As high as the picker and with its edge, so the bar keeps its height with and without it. -->
      <IconButton
        v-if="current !== null"
        size="sm"
        class="border border-zinc-800 bg-white dark:bg-zinc-100"
        :label="t('look.remove', { name: current.name })"
        data-testid="look-remove"
        @click="remove(current.name)"
      >
        <path :d="TRASH_PATH" />
      </IconButton>
    </div>

    <div
      class="flex min-w-44 flex-[1_1_12rem] items-center gap-2"
      :class="{ 'opacity-50': current === null }"
    >
      <label for="look-strength" class="font-semibold">{{ t('look.strength') }}</label>
      <input
        id="look-strength"
        type="range"
        min="0"
        max="100"
        step="1"
        class="min-w-0 flex-1 accent-emerald-700"
        :value="strength"
        :disabled="current === null"
        data-testid="look-strength"
        @input="onStrength"
      />
      <output
        for="look-strength"
        class="w-10 text-right font-semibold tabular-nums"
        :aria-label="t('look.strength')"
        >{{ strengthText }}</output
      >
    </div>
  </div>

  <!-- Room for two lines, as long as the hint, so that a message does not move what lies below. -->
  <div
    class="mt-1.5 flex min-h-[2lh] flex-col gap-1.5 text-xs leading-snug"
    data-testid="look-messages"
  >
    <p v-if="list.length === 0 && messages.length === 0" class="text-zinc-600">
      {{ t('look.hint') }}
    </p>
    <template v-for="(message, index) in messages" :key="index">
      <p v-if="message.kind === 'rejected'" class="text-red-700 dark:text-red-400" role="alert">
        {{ text(message) }}
      </p>
      <div
        v-else-if="message.kind === 'logConversion'"
        class="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
        role="status"
      >
        <p>{{ text(message) }}</p>
        <button
          type="button"
          class="mt-1.5 rounded border border-current px-2 py-0.5 hover:bg-amber-200 dark:hover:bg-amber-900"
          data-testid="look-remove-again"
          @click="remove(message.name)"
        >
          {{ t('look.messages.removeAgain') }}
        </button>
      </div>
      <p v-else-if="message.kind === 'removed'" class="text-zinc-600" role="status">
        {{ text(message) }}
        <button type="button" :class="LINK_BUTTON" data-testid="look-undo" @click="undo">
          {{ t('look.messages.undo') }}
        </button>
      </p>
      <p v-else-if="message.kind === 'imported'" class="text-zinc-600" role="status">
        {{ text(message) }}
      </p>
      <p v-else class="text-amber-800 dark:text-amber-300" role="status">
        {{ text(message) }}
      </p>
    </template>
  </div>
</template>
