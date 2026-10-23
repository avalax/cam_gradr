<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';

import { useProjectStore } from '../project/project-store';

const { t } = useI18n();
const project = useProjectStore();
const { error, notice } = storeToRefs(project);
</script>

<template>
  <!-- Floats above the page and does not push the content away. -->
  <div
    v-if="error !== null || notice !== null"
    class="fixed bottom-4 left-1/2 z-30 flex w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 items-start gap-3 rounded-lg border border-zinc-400 bg-white dark:bg-zinc-100 p-3 shadow-lg"
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
        class="text-sm text-slate-700 dark:text-slate-300"
        role="status"
        data-testid="project-notice"
      >
        {{ notice }}
      </p>
    </div>
    <button
      type="button"
      class="rounded px-1.5 text-zinc-500 hover:bg-zinc-100"
      :aria-label="t('project.status.close')"
      data-testid="project-message-close"
      @click="project.dismiss()"
    >
      ✕
    </button>
  </div>
</template>
