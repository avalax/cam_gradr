<script setup lang="ts" generic="T">
// A choice as a row of chips, one radio button each: language, appearance, resolution. `key` tells
// the options apart (`selected` is the key of the chosen one) and `lang` names the language of a
// label for screen readers. The label of the group (aria-label or aria-labelledby) and a test id go to
// the group.
defineProps<{
  options: readonly { key: string; value: T; label: string; lang?: string }[];
  selected: string;
  disabled?: boolean;
}>();
const emit = defineEmits<{ choose: [value: T] }>();
</script>

<template>
  <div role="radiogroup" class="flex flex-wrap gap-1.5">
    <button
      v-for="option in options"
      :key="option.key"
      type="button"
      role="radio"
      class="rounded-full border px-3 py-0.5 text-xs disabled:opacity-50"
      :class="
        option.key === selected
          ? 'border-zinc-800 bg-zinc-800 text-zinc-50'
          : 'border-zinc-400 bg-white text-zinc-800 dark:bg-zinc-100'
      "
      :aria-checked="option.key === selected"
      :lang="option.lang"
      :disabled="disabled"
      :data-option="option.key"
      @click="emit('choose', option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>
