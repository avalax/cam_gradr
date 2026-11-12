<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import type { StageState } from './stage-state';

const { t } = useI18n();

// Camera off, live image or still image, as the band above the image of the card tabs (always there,
// so that the image never moves when the camera starts; as high as the band of the preview, so that
// all tabs are equally high). `label` replaces the text where the camera is not what the image area
// waits for (the preview without a correction).
withDefaults(defineProps<{ state: StageState; label?: string | null }>(), { label: null });

const TEXTS: Readonly<Record<StageState, string>> = {
  off: 'cards.stage.labelOff',
  live: 'cards.stage.labelLive',
  still: 'cards.stage.labelStill',
};
</script>

<template>
  <div
    class="flex items-center justify-center border-b-(length:--band-line) border-zinc-700 bg-zinc-200 px-1 py-1.5 text-[11px] font-semibold leading-tight text-zinc-800"
    :data-state="state"
  >
    {{ label ?? t(TEXTS[state]) }}
  </div>
</template>
