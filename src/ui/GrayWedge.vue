<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import type { WedgeRow } from './gray-wedge';

const { t } = useI18n();
const props = defineProps<{ rows: readonly WedgeRow[] }>();

// Target only if there is a reference set.
const hasTarget = computed(() => props.rows.some((row) => row.target !== null));
const columns = computed(() => [
  ...(hasTarget.value ? [{ key: 'target', label: t('wedge.target') } as const] : []),
  { key: 'camera', label: t('wedge.camera') } as const,
  { key: 'corrected', label: t('wedge.corrected') } as const,
]);
</script>

<template>
  <!-- Gray wedge: the neutral patches from light to dark; a neutral gray must look neutral. -->
  <div
    class="grid size-full gap-[3px]"
    :style="{ gridTemplateColumns: `repeat(${String(columns.length)}, minmax(0, 1fr))` }"
    role="img"
    :aria-label="t('wedge.grayAria')"
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
