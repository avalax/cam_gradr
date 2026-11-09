<script setup lang="ts" generic="T">
import { computed, useTemplateRef } from 'vue';

import { rovingTarget } from './roving';

// A choice as a row of radio buttons: chips (language, appearance, resolution), a segmented control
// that fills a narrow band in small type (the view of the preview's side column) or cards that also
// show a detail and a hint (the sizes of the export). `key` tells the options apart (`selected` is the
// key of the chosen one), `lang` names the language of a label for screen readers, and `disabled`
// locks the whole group. The label of the group (aria-label or aria-labelledby) and a test id go to
// the group. As a WAI-ARIA radio group it is one stop of the Tab key; the arrow keys choose the next
// option.
const props = withDefaults(
  defineProps<{
    options: readonly {
      key: string;
      value: T;
      label: string;
      lang?: string;
      // Only shown by the cards: beside the label, and in a line below it.
      detail?: string;
      hint?: string;
    }[];
    selected: string;
    disabled?: boolean;
    variant?: 'chips' | 'segmented' | 'cards';
  }>(),
  { disabled: false, variant: 'chips' },
);
const emit = defineEmits<{ choose: [value: T] }>();

const group = useTemplateRef<HTMLElement>('group');

// Hover only reaches options that can be chosen. The segmented control clips its corners, so its
// options draw the focus ring inside.
const STYLES = {
  chips: {
    group: 'flex flex-wrap gap-1.5',
    option: 'rounded-full border px-3 py-0.5 text-xs disabled:opacity-50',
    on: 'border-zinc-800 bg-zinc-800 text-zinc-50',
    off: 'border-zinc-400 bg-surface text-zinc-800 enabled:hover:bg-zinc-200',
  },
  // The chosen card has a border of 2 px; the others have 1 px and a margin of 1 px, so that the cards
  // keep their size. The group is a size container, so that all cards put their detail beside or
  // below the label together; stacked, they keep less room at the sides, so that a hint such as „für
  // ältere Geräte“ stays on one line. The content starts at the top of every card.
  cards: {
    group: '@container grid grid-cols-3 gap-2',
    option:
      'flex flex-col rounded-lg px-2 py-1.5 text-left leading-snug disabled:opacity-50 @md:px-3',
    on: 'border-2 border-zinc-800 bg-surface',
    off: 'm-px border border-zinc-300 bg-zinc-50 enabled:hover:bg-zinc-200',
  },
  segmented: {
    group: 'flex w-full overflow-hidden rounded border border-zinc-500 text-[11px] font-semibold',
    option: 'focus-ring-inset flex-1 border-zinc-500 px-1 py-1 [&:not(:first-child)]:border-l',
    on: 'bg-zinc-800 text-zinc-50',
    off: 'bg-surface text-zinc-800 enabled:hover:bg-zinc-200',
  },
} as const;
const styles = computed(() => STYLES[props.variant]);

// The option that takes the Tab stop: the chosen one (every caller has one chosen).
const tabStop = computed(() => props.options.findIndex((option) => option.key === props.selected));

// An arrow key moves the focus to the next option and chooses it, as a click would.
function onKey(event: KeyboardEvent, index: number): void {
  const next = rovingTarget(event.key, index, props.options.length, true);
  if (next !== null) {
    event.preventDefault();
    const target = group.value?.children[next] as HTMLButtonElement | undefined;
    target?.focus();
    target?.click();
  }
}
</script>

<template>
  <div ref="group" role="radiogroup" :class="styles.group">
    <button
      v-for="(option, index) in options"
      :key="option.key"
      type="button"
      role="radio"
      :class="[styles.option, option.key === selected ? styles.on : styles.off]"
      :aria-checked="option.key === selected"
      :tabindex="index === tabStop ? 0 : -1"
      :lang="option.lang"
      :disabled="disabled"
      :data-option="option.key"
      @click="emit('choose', option.value)"
      @keydown="onKey($event, index)"
    >
      <!-- The detail stands beside the label where the group has room for it on every card (28 rem),
           otherwise below it on every card, as one piece. -->
      <template v-if="variant === 'cards'">
        <span class="flex flex-col @md:flex-row @md:items-baseline @md:justify-between @md:gap-2">
          <span class="text-[15px] font-semibold">{{ option.label }}</span>
          <span class="whitespace-nowrap text-xs text-zinc-600">{{ option.detail }}</span>
        </span>
        <span class="block text-xs text-zinc-500">{{ option.hint }}</span>
      </template>
      <template v-else>{{ option.label }}</template>
    </button>
  </div>
</template>
