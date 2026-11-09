<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { useProjectStore } from '../project/project-store';

import IconButton from './IconButton.vue';

const { t } = useI18n();
const project = useProjectStore();
const { error, notice } = storeToRefs(project);
const shown = computed(() => error.value !== null || notice.value !== null);

// Closing the message takes its button away: the focus goes back to where it was when the message
// appeared (saving or loading in the export) or, once that is gone with its tab, to the open tab.
let before: HTMLElement | null = null;
watch(shown, (now) => {
  if (now) {
    before =
      document.activeElement === document.body ? null : (document.activeElement as HTMLElement);
  }
});

function close(): void {
  project.dismiss();
  const target =
    before?.isConnected === true
      ? before
      : document.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
  target?.focus();
}
</script>

<template>
  <!-- Floats above the page and does not push the content away. -->
  <div
    v-if="shown"
    class="fixed bottom-4 left-1/2 z-30 flex w-max max-w-[min(64rem,calc(100vw-2rem))] -translate-x-1/2 items-start gap-3 rounded-lg border border-zinc-400 bg-surface p-3 shadow-lg"
    data-testid="project-message"
  >
    <div class="min-w-0 flex-1 space-y-1">
      <p
        v-if="error !== null"
        class="text-sm text-red-700 dark:text-red-400"
        role="alert"
        data-testid="project-error"
      >
        {{ error }}
      </p>
      <p
        v-if="notice !== null"
        class="text-sm text-zinc-700"
        role="status"
        data-testid="project-notice"
      >
        {{ notice }}
      </p>
    </div>
    <IconButton
      size="sm"
      :label="t('project.status.close')"
      data-testid="project-message-close"
      @click="close"
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </IconButton>
  </div>
</template>
