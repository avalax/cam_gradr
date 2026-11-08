<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import IconButton from './IconButton.vue';

// The action in the toolbar at the top right of the image: the trash on the card tabs, the camera in
// the preview. Actions sit on the image, so the columns beside it only describe. Everything else
// given to the component (disabled, test id, click) goes to the button; the icon's paths come as
// slot content. The toolbar clips its corner, so the focus ring is drawn inside the button.
defineOptions({ inheritAttrs: false });
defineProps<{ label: string; title: string }>();

const { t } = useI18n();
</script>

<template>
  <div
    class="absolute right-0 top-0 z-10 flex overflow-hidden rounded-bl-lg border-b border-l border-zinc-500 bg-zinc-50"
    role="toolbar"
    :aria-label="t('app.imageToolbar')"
  >
    <IconButton :label="label" :title="title" class="focus-ring-inset" v-bind="$attrs">
      <slot />
    </IconButton>
  </div>
</template>
