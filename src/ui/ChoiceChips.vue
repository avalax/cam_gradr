<script setup lang="ts" generic="T">
import { computed, useTemplateRef } from 'vue';

import { rovingTarget } from './roving';

// A choice as a row of radio buttons: chips (language, appearance, resolution) or one segmented
// control (the content and size of the export; `compact` fills a narrow band in small type, as the
// view of the preview's side column). `key` tells the options apart (`selected` is the key of the
// chosen one), `lang` names the language of a label for screen readers, and an option can be locked
// on its own. The label of the group (aria-label or aria-labelledby) and a test id go to the group.
// As a WAI-ARIA radio group it is one stop of the Tab key; the arrow keys choose the next option.
const props = withDefaults(
  defineProps<{
    options: readonly { key: string; value: T; label: string; lang?: string; disabled?: boolean }[];
    selected: string;
    disabled?: boolean;
    variant?: 'chips' | 'segmented';
    compact?: boolean;
  }>(),
  { disabled: false, variant: 'chips', compact: false },
);
const emit = defineEmits<{ choose: [value: T] }>();

const group = useTemplateRef<HTMLElement>('group');

// Hover only reaches options that can be chosen.
const STYLES = {
  chips: {
    group: 'flex flex-wrap gap-1.5',
    option: 'rounded-full border px-3 py-0.5 text-xs disabled:opacity-50',
    on: 'border-zinc-800 bg-zinc-800 text-zinc-50',
    off: 'border-zinc-400 bg-white text-zinc-800 enabled:hover:bg-zinc-200 dark:bg-zinc-100',
  },
  segmented: {
    group: 'inline-flex w-fit overflow-hidden rounded-md border border-zinc-500 text-sm',
    option: 'border-zinc-500 px-3 py-1 [&:not(:first-child)]:border-l disabled:text-zinc-500',
    on: 'bg-zinc-800 text-zinc-50',
    off: 'bg-white text-zinc-800 enabled:hover:bg-zinc-200 dark:bg-zinc-100',
  },
  compact: {
    group: 'flex w-full overflow-hidden rounded border border-zinc-500 text-[11px] font-semibold',
    option: 'flex-1 border-zinc-500 px-1 py-1 [&:not(:first-child)]:border-l',
    on: 'bg-zinc-800 text-zinc-50',
    off: 'bg-white text-zinc-800 enabled:hover:bg-zinc-200 dark:bg-zinc-100',
  },
} as const;
const styles = computed(() =>
  props.variant === 'segmented' && props.compact ? STYLES.compact : STYLES[props.variant],
);

const enabled = computed(() =>
  props.options.map((option) => !props.disabled && option.disabled !== true),
);
// The option that takes the Tab stop: the chosen one, or the first that can be chosen.
const tabStop = computed(() => {
  const chosen = props.options.findIndex((option) => option.key === props.selected);
  return enabled.value[chosen] === true ? chosen : enabled.value.indexOf(true);
});

// An arrow key moves the focus to the next option and chooses it, as a click would.
function onKey(event: KeyboardEvent, index: number): void {
  const next = rovingTarget(event.key, index, enabled.value, true);
  if (next !== null) {
    event.preventDefault();
    const target = group.value?.children[next] as HTMLButtonElement | undefined;
    target?.focus();
    target?.click();
  }
}
</script>

<template>
  <div
    ref="group"
    role="radiogroup"
    :class="[styles.group, { 'opacity-50': variant === 'segmented' && disabled }]"
  >
    <button
      v-for="(option, index) in options"
      :key="option.key"
      type="button"
      role="radio"
      :class="[styles.option, option.key === selected ? styles.on : styles.off]"
      :aria-checked="option.key === selected"
      :tabindex="index === tabStop ? 0 : -1"
      :lang="option.lang"
      :disabled="disabled || option.disabled"
      :data-option="option.key"
      @click="emit('choose', option.value)"
      @keydown="onKey($event, index)"
    >
      {{ option.label }}
    </button>
  </div>
</template>
