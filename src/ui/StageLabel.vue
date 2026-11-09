<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import type { StageState } from './stage-state';

const { t } = useI18n();

// Camera off, live image or still image, with a dot: as the band above the image of the card tabs
// (always there, so that the image never moves when the camera starts; as high as the band of the
// preview, so that all tabs are equally high), or as a badge in the image corner of the preview,
// whose band names the sides of the divider. `label` replaces the text where the camera is not what
// the image area waits for (the preview without a correction).
withDefaults(
  defineProps<{ state: StageState; variant?: 'band' | 'badge'; label?: string | null }>(),
  { variant: 'band', label: null },
);

const TEXTS: Readonly<Record<StageState, string>> = {
  off: 'cards.stage.labelOff',
  live: 'cards.stage.labelLive',
  still: 'cards.stage.labelStill',
};
const DOTS: Readonly<Record<StageState, string>> = {
  off: 'border border-zinc-500',
  live: 'bg-emerald-700 dark:bg-emerald-400',
  still: 'bg-zinc-400 dark:bg-zinc-500',
};
const VARIANTS = {
  band: 'justify-center border-b-(length:--band-line) border-zinc-700 bg-zinc-200 px-1 py-1.5',
  badge:
    'pointer-events-none absolute left-0 top-0 z-10 rounded-br-lg border-b border-r border-zinc-500 bg-zinc-50 px-2.5 py-1.5',
} as const;
</script>

<template>
  <div
    class="flex items-center gap-1.5 text-[11px] font-semibold leading-tight text-zinc-800"
    :class="VARIANTS[variant]"
    :data-state="state"
  >
    <i class="size-2.5 shrink-0 rounded-full" :class="DOTS[state]" aria-hidden="true"></i>
    {{ label ?? t(TEXTS[state]) }}
  </div>
</template>
