<script setup lang="ts" generic="T">
// A choice as a row of radio buttons: chips (language, appearance, resolution) or one segmented
// control (the content and size of the export). `key` tells the options apart (`selected` is the key
// of the chosen one), `lang` names the language of a label for screen readers, and an option can be
// locked on its own. The label of the group (aria-label or aria-labelledby) and a test id go to the
// group.
const props = withDefaults(
  defineProps<{
    options: readonly { key: string; value: T; label: string; lang?: string; disabled?: boolean }[];
    selected: string;
    disabled?: boolean;
    variant?: 'chips' | 'segmented';
  }>(),
  { disabled: false, variant: 'chips' },
);
const emit = defineEmits<{ choose: [value: T] }>();

const STYLES = {
  chips: {
    group: 'flex flex-wrap gap-1.5',
    option: 'rounded-full border px-3 py-0.5 text-xs disabled:opacity-50',
    on: 'border-zinc-800 bg-zinc-800 text-zinc-50',
    off: 'border-zinc-400 bg-white text-zinc-800 dark:bg-zinc-100',
  },
  segmented: {
    group: 'inline-flex w-fit overflow-hidden rounded-md border border-zinc-500 text-sm',
    option: 'border-zinc-500 px-3 py-1 [&:not(:first-child)]:border-l disabled:text-zinc-500',
    on: 'bg-zinc-800 text-zinc-50',
    off: 'bg-white text-zinc-800 dark:bg-zinc-100',
  },
} as const;
</script>

<template>
  <div
    role="radiogroup"
    :class="[STYLES[props.variant].group, { 'opacity-50': variant === 'segmented' && disabled }]"
  >
    <button
      v-for="option in options"
      :key="option.key"
      type="button"
      role="radio"
      :class="[
        STYLES[props.variant].option,
        option.key === selected ? STYLES[props.variant].on : STYLES[props.variant].off,
      ]"
      :aria-checked="option.key === selected"
      :lang="option.lang"
      :disabled="disabled || option.disabled"
      :data-option="option.key"
      @click="emit('choose', option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>
