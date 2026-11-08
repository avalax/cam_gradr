<script setup lang="ts">
import LineIcon from './LineIcon.vue';

// The one icon button of the app (trash, camera, close): a line icon in the text color that inverts
// on hover. "md" fills the image toolbar, "sm" fits the bars and messages. The title defaults to the
// label; everything else (class, disabled, test id, click) goes to the button.
withDefaults(defineProps<{ label: string; title?: string; size?: 'md' | 'sm' }>(), {
  title: (props: { label: string }) => props.label,
  size: 'md',
});
</script>

<template>
  <button
    type="button"
    class="grid shrink-0 place-items-center text-zinc-800 hover:bg-zinc-800 hover:text-zinc-50 disabled:pointer-events-none disabled:opacity-50"
    :class="size === 'sm' ? 'size-[26px] rounded' : 'h-9 w-10'"
    :aria-label="label"
    :title="title"
  >
    <LineIcon :class="size === 'sm' ? 'size-[15px]' : 'size-[18px]'"><slot /></LineIcon>
  </button>
</template>
