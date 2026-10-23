<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<template>
  <!-- Names the two sides of a wipe: camera on the left, corrected on the right (grey and green dot). -->
  <div
    class="grid grid-cols-2 border-b-[3px] border-zinc-700 bg-zinc-200 text-[11px] font-semibold leading-tight text-zinc-800"
  >
    <span class="flex items-center justify-center gap-1.5 px-1 py-1.5">
      <i class="size-2.5 shrink-0 rounded-full bg-zinc-400" aria-hidden="true"></i>
      {{ t('preview.labelCamera') }}
    </span>
    <span class="flex items-center justify-center gap-1.5 border-l border-zinc-400 px-1 py-1.5">
      {{ t('preview.labelCorrected') }}
      <i class="size-2.5 shrink-0 rounded-full bg-emerald-700" aria-hidden="true"></i>
    </span>
  </div>
</template>
