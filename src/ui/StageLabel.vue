<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

// Live image or captured still image; the band is as high as the one of the preview, so that all
// tabs are equally high.
defineProps<{ still: boolean }>();
</script>

<template>
  <div
    class="flex items-center justify-center gap-1.5 border-b-(length:--band-line) border-zinc-700 bg-zinc-200 px-1 py-1.5 text-[11px] font-semibold leading-tight text-zinc-800"
  >
    <i
      class="size-2.5 shrink-0 rounded-full"
      :class="still ? 'bg-zinc-400 dark:bg-zinc-500' : 'bg-emerald-700 dark:bg-emerald-400'"
      aria-hidden="true"
    ></i>
    {{ t(still ? 'cards.stage.labelStill' : 'cards.stage.labelLive') }}
  </div>
</template>
