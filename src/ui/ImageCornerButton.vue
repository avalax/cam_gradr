<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import LineIcon from './LineIcon.vue';

// The action in the toolbar at the top right of the image: the trash on the card tabs, the camera in
// the preview. Actions sit on the image, so the columns beside it only describe. Everything else
// given to the component (disabled, test id, click) goes to the button; the icon's paths come as
// slot content.
defineOptions({ inheritAttrs: false });
defineProps<{ label: string; title: string }>();

const { t } = useI18n();
</script>

<template>
  <div
    class="absolute right-0 top-0 z-10 flex overflow-hidden rounded-bl-lg border-b border-l border-zinc-500 bg-zinc-50 text-zinc-800"
    role="toolbar"
    :aria-label="t('app.imageToolbar')"
  >
    <button
      type="button"
      class="grid h-9 w-10 place-items-center hover:bg-zinc-800 hover:text-zinc-50 focus-visible:bg-zinc-800 focus-visible:text-zinc-50 disabled:pointer-events-none disabled:opacity-50"
      :aria-label="label"
      :title="title"
      v-bind="$attrs"
    >
      <LineIcon class="size-[18px]"><slot /></LineIcon>
    </button>
  </div>
</template>
