<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, useTemplateRef } from 'vue';
import { useI18n } from 'vue-i18n';

import { useLookStore } from '../look/look-store';
import type { LookMessage } from '../look/look-store';
import { usePreviewStore } from '../lut/preview-store';

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
      <label for="look-select" class="font-semibold">{{ t('look.label') }}</label>
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
      <button
        v-if="current !== null"
        type="button"
        class="grid size-[26px] shrink-0 place-items-center rounded border border-zinc-500 bg-white text-zinc-800 hover:border-red-700 hover:text-red-700 dark:bg-zinc-100"
        :aria-label="t('look.remove', { name: current.name })"
        :title="t('look.remove', { name: current.name })"
        data-testid="look-remove"
        @click="looks.remove(current.name)"
      >
        <svg
          class="size-[15px]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
        </svg>
      </button>
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

  <div class="mt-1.5 flex flex-col gap-1.5 text-xs leading-snug" data-testid="look-messages">
    <p v-if="list.length === 0 && messages.length === 0" class="text-slate-600 dark:text-slate-400">
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
          class="mt-1.5 rounded border border-current px-2 py-0.5"
          data-testid="look-remove-again"
          @click="looks.remove(message.name)"
        >
          {{ t('look.messages.removeAgain') }}
        </button>
      </div>
      <p
        v-else-if="message.kind === 'removed'"
        class="text-slate-600 dark:text-slate-400"
        role="status"
      >
        {{ text(message) }}
        <button
          type="button"
          class="font-semibold text-zinc-900 underline"
          data-testid="look-undo"
          @click="looks.undo()"
        >
          {{ t('look.messages.undo') }}
        </button>
      </p>
      <p
        v-else-if="message.kind === 'imported'"
        class="text-slate-600 dark:text-slate-400"
        role="status"
      >
        {{ text(message) }}
      </p>
      <p v-else class="text-amber-800 dark:text-amber-300" role="status">
        {{ text(message) }}
      </p>
    </template>
  </div>
</template>
