<script setup lang="ts" generic="T">
import { computed, useTemplateRef } from 'vue';

import { rovingTarget } from './roving';

// A choice as a row of radio buttons: chips (language, appearance, resolution), one segmented control
// (`compact` fills a narrow band in small type, as the view of the preview's side column) or cards
// that also show a detail and a hint (the sizes of the export). `key` tells the options apart (`selected` is the key of the
// chosen one), `lang` names the language of a label for screen readers, and an option can be locked
// on its own. The label of the group (aria-label or aria-labelledby) and a test id go to the group.
// As a WAI-ARIA radio group it is one stop of the Tab key; the arrow keys choose the next option.
const props = withDefaults(
  defineProps<{
    options: readonly {
      key: string;
      value: T;
      label: string;
      lang?: string;
      disabled?: boolean;
      // Only shown by the cards: beside the label, and in a line below it.
      detail?: string;
      hint?: string;
    }[];
    selected: string;
    disabled?: boolean;
    variant?: 'chips' | 'segmented' | 'cards';
    compact?: boolean;
  }>(),
  { disabled: false, variant: 'chips', compact: false },
);
const emit = defineEmits<{ choose: [value: T] }>();

const group = useTemplateRef<HTMLElement>('group');

// Hover only reaches options that can be chosen. The segmented controls clip their corners, so their
// options draw the focus ring inside.
const STYLES = {
  chips: {
    group: 'flex flex-wrap gap-1.5',
    option: 'rounded-full border px-3 py-0.5 text-xs disabled:opacity-50',
    on: 'border-zinc-800 bg-zinc-800 text-zinc-50',
    off: 'border-zinc-400 bg-white text-zinc-800 enabled:hover:bg-zinc-200 dark:bg-zinc-100',
  },
  segmented: {
    group: 'inline-flex w-fit overflow-hidden rounded-md border border-zinc-500 text-sm',
    option:
      'focus-ring-inset border-zinc-500 px-3 py-1 [&:not(:first-child)]:border-l disabled:text-zinc-500',
    on: 'bg-zinc-800 text-zinc-50',
    off: 'bg-white text-zinc-800 enabled:hover:bg-zinc-200 dark:bg-zinc-100',
  },
  // The chosen card has a border of 2 px; the others have 1 px and a margin of 1 px, so that the cards
  // keep their size.
  cards: {
    group: 'grid grid-cols-3 gap-2',
    option: 'rounded-lg px-3 py-1.5 text-left leading-snug disabled:opacity-50',
    on: 'border-2 border-zinc-800 bg-white dark:bg-zinc-100',
    off: 'm-px border border-zinc-300 bg-zinc-50 enabled:hover:bg-zinc-200',
  },
  compact: {
    group: 'flex w-full overflow-hidden rounded border border-zinc-500 text-[11px] font-semibold',
    option: 'focus-ring-inset flex-1 border-zinc-500 px-1 py-1 [&:not(:first-child)]:border-l',
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
      <template v-if="variant === 'cards'">
        <span class="flex items-baseline justify-between gap-2">
          <span class="text-[15px] font-semibold">{{ option.label }}</span>
          <span class="text-xs text-zinc-600">{{ option.detail }}</span>
        </span>
        <span class="block text-xs text-zinc-500">{{ option.hint }}</span>
      </template>
      <template v-else>{{ option.label }}</template>
    </button>
  </div>
</template>
