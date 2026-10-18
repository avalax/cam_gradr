<script setup lang="ts">
import { computed } from 'vue';

import type { WedgeRow } from './gray-wedge';

const props = defineProps<{ rows: readonly WedgeRow[] }>();

// Soll nur, wenn es einen Referenzsatz gibt.
const hasTarget = computed(() => props.rows.some((row) => row.target !== null));
const columns = computed(() => [
  ...(hasTarget.value ? [{ key: 'target', label: 'Soll' } as const] : []),
  { key: 'camera', label: 'Kamera' } as const,
  { key: 'corrected', label: 'korr.' } as const,
]);
</script>

<template>
  <!-- Graukeil: die Neutralfelder von hell nach dunkel; ein neutrales Grau muss neutral aussehen. -->
  <div
    class="grid size-full gap-[3px]"
    :style="{ gridTemplateColumns: `repeat(${String(columns.length)}, minmax(0, 1fr))` }"
    role="img"
    aria-label="Graustufen der Farbkarten: Soll, Kamera und nach der Korrektur"
    data-testid="gray-wedge"
  >
    <div v-for="column in columns" :key="column.key" class="flex min-h-0 flex-col gap-0.5">
      <span class="text-center text-[9px] font-semibold text-zinc-600">{{ column.label }}</span>
      <div class="flex min-h-0 flex-1 flex-col gap-0.5" :data-column="column.key">
        <i
          v-for="row in rows"
          :key="row.id"
          class="block min-h-0 flex-1 rounded-[1px]"
          :style="{ background: row[column.key] ?? undefined }"
          :title="row.id"
          :data-patch="row.id"
        ></i>
      </div>
    </div>
  </div>
</template>
