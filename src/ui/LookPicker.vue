<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue';

// Choosing the look LUT, as a select-only combobox (WAI-ARIA): unlike the browser's own select, every
// step with the arrow keys applies the look at once, also while the list is open; Escape goes back to
// the look from before. The last entry is an action, it only runs on Enter or a click.
const props = defineProps<{
  // Names of the imported looks.
  names: readonly string[];
  // Text of the first entry (no look) and of the last one (import).
  noneText: string;
  importText: string;
}>();
const chosen = defineModel<string | null>({ required: true });
const emit = defineEmits<{ import: [] }>();

const open = ref(false);
// The highlighted entry: 0 is "no look", then the looks, then the import.
const active = ref(0);
// The look when the list opened, for Escape.
let before: string | null = null;
const list = useTemplateRef<HTMLUListElement>('list');

const lastLook = computed(() => props.names.length);
const importIndex = computed(() => props.names.length + 1);
const selectedIndex = computed(() =>
  chosen.value === null ? 0 : props.names.indexOf(chosen.value) + 1,
);
const shown = computed(() => chosen.value ?? props.noneText);
const entries = computed(() => [props.noneText, ...props.names, props.importText]);

function valueAt(index: number): string | null {
  // Only called for entries of the list, so a look exists at every index above 0.
  return index === 0 ? null : String(props.names[index - 1]);
}

function clamp(index: number, highest: number): number {
  return Math.min(Math.max(index, 0), highest);
}

// Moves to an entry; a look (or "no look") applies at once, the import entry only highlights.
function moveTo(index: number): void {
  active.value = clamp(index, open.value ? importIndex.value : lastLook.value);
  if (active.value !== importIndex.value) {
    chosen.value = valueAt(active.value);
  }
}

function openList(): void {
  before = chosen.value;
  active.value = selectedIndex.value;
  open.value = true;
}

function close(): void {
  open.value = false;
}

function choose(index: number): void {
  close();
  if (index === importIndex.value) {
    chosen.value = before;
    emit('import');
    return;
  }
  chosen.value = valueAt(index);
}

function toggle(): void {
  if (open.value) {
    close();
  } else {
    openList();
  }
}

// Enter and Space open the list, or take the highlighted entry when it is open.
function confirm(): void {
  if (open.value) {
    choose(active.value);
  } else {
    openList();
  }
}

const KEYS: Record<string, (event: KeyboardEvent) => void> = {
  ArrowDown: (event) => {
    if (event.altKey && !open.value) {
      openList();
    } else {
      moveTo((open.value ? active.value : selectedIndex.value) + 1);
    }
  },
  ArrowUp: () => {
    moveTo((open.value ? active.value : selectedIndex.value) - 1);
  },
  Home: () => {
    moveTo(0);
  },
  End: () => {
    moveTo(open.value ? importIndex.value : lastLook.value);
  },
  Enter: confirm,
  ' ': confirm,
  Escape: () => {
    if (open.value) {
      chosen.value = before;
      close();
    }
  },
};

function onKey(event: KeyboardEvent): void {
  const handle = KEYS[event.key];
  if (handle !== undefined) {
    event.preventDefault();
    handle(event);
  }
}

// The highlighted entry stays visible in a long list.
watch(active, async (index) => {
  await nextTick();
  list.value?.children.item(index)?.scrollIntoView({ block: 'nearest' });
});
</script>

<template>
  <div class="relative min-w-0 max-w-60 flex-auto">
    <button
      id="look-select"
      type="button"
      role="combobox"
      aria-haspopup="listbox"
      aria-controls="look-list"
      :aria-expanded="open"
      :aria-activedescendant="open ? `look-option-${String(active)}` : undefined"
      class="flex w-full min-w-0 items-center gap-1 rounded border border-zinc-800 bg-white px-1.5 py-0.5 text-left dark:bg-zinc-100"
      data-testid="look-select"
      @click="toggle"
      @keydown="onKey"
      @blur="close"
    >
      <span class="min-w-0 flex-1 truncate">{{ shown }}</span>
      <svg
        class="size-3 shrink-0"
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        aria-hidden="true"
      >
        <path d="M2.5 4.5 6 8l3.5-3.5" />
      </svg>
    </button>
    <ul
      v-if="open"
      id="look-list"
      ref="list"
      role="listbox"
      class="absolute left-0 top-full z-20 mt-0.5 max-h-72 min-w-full overflow-auto rounded border border-zinc-500 bg-white py-1 shadow-lg dark:bg-zinc-100"
      data-testid="look-list"
    >
      <!-- eslint-disable-next-line vuejs-accessibility/click-events-have-key-events, vuejs-accessibility/interactive-supports-focus -- the combobox keeps the focus and handles the keys for its options (aria-activedescendant) -->
      <li
        v-for="(text, index) in entries"
        :id="`look-option-${String(index)}`"
        :key="index"
        role="option"
        :aria-selected="index === selectedIndex"
        class="cursor-pointer whitespace-nowrap px-2.5 py-1"
        :class="[
          index === active ? 'bg-zinc-800 text-zinc-50' : 'hover:bg-zinc-200',
          { 'mt-1 border-t border-zinc-300 font-semibold': index === importIndex },
        ]"
        @mousedown.prevent
        @click="choose(index)"
      >
        {{ text }}
      </li>
    </ul>
  </div>
</template>
