<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, ref } from 'vue';
import { I18nT, useI18n } from 'vue-i18n';

import { useChartStore, useColorChartStore } from '../chart/chart-store';
import { CUBE_SIZES, formatCube } from '../lut/cube';
import { downloadFile } from '../lut/download';
import { buildLut } from '../lut/lut';
import { useReferenceStore } from '../reference/reference-store';
import { useSolveStore } from '../solve/solve-store';

import LutSlices from './LutSlices.vue';
import ProjectBar from './ProjectBar.vue';
import { cubeSizeText } from './lut-slices';

const emit = defineEmits<{ goto: [tab: 'color'] }>();

const DEFAULT_SIZE = 33;

const { t } = useI18n();

const solve = useSolveStore();
const { model } = storeToRefs(solve);
const { selected } = storeToRefs(useReferenceStore());
const gray = useChartStore();
const color = useColorChartStore();

// What the project file contains: per card pair the corner points and measured patches.
function chartFacts(state: { points: Record<number, unknown[]>; measurements: object }): string {
  const corners = Object.values(state.points).reduce((sum, list) => sum + list.length, 0);
  const fields = Object.keys(state.measurements).length;
  return corners === 0 && fields === 0
    ? '–'
    : t('export.project.corners', { corners: String(corners), fields: String(fields) });
}
const facts = computed(() => [
  { label: t('export.project.gray'), value: chartFacts(gray.committed()) },
  { label: t('export.project.color'), value: chartFacts(color.committed()) },
  {
    label: t('export.project.correction'),
    value: model.value === null ? '–' : t('export.project.correctionValue'),
  },
  { label: t('export.project.reference'), value: selected.value?.name ?? '–' },
]);
const size = ref<number>(DEFAULT_SIZE);

const fileName = computed(() => `cam_gradr-${String(size.value)}.cube`);
const fileInfo = computed(
  () =>
    `${String(size.value)} × ${String(size.value)} × ${String(size.value)} · ${cubeSizeText(size.value)}`,
);

function onSize(next: number): void {
  size.value = next;
}

function download(): void {
  const current = model.value;
  if (current !== null) {
    downloadFile(
      fileName.value,
      formatCube(buildLut(current, size.value), 'cam_gradr'),
      'text/plain',
    );
  }
}
</script>

<template>
  <section class="flex max-w-5xl flex-1 flex-col gap-4">
    <div class="grid flex-1 gap-3 lg:grid-cols-[1.3fr_1fr]">
      <!-- Without color correction you see what you would get: same layout, but grayed out. -->
      <article
        class="flex flex-col gap-2 rounded-lg border p-3"
        :class="
          model === null
            ? 'border-dashed border-zinc-300 bg-zinc-100'
            : 'border-zinc-300 bg-zinc-50'
        "
        aria-labelledby="lut-heading"
      >
        <h2 id="lut-heading" class="text-sm font-semibold">{{ t('export.lut.heading') }}</h2>
        <I18nT keypath="export.lut.description" tag="p" class="text-xs text-zinc-600">
          <template #file><code>.cube</code></template>
        </I18nT>
        <div
          role="radiogroup"
          :aria-label="t('export.lut.sizeLabel')"
          class="inline-flex w-fit overflow-hidden rounded-md border border-zinc-500 text-sm"
          :class="{ 'opacity-50': model === null }"
        >
          <button
            v-for="option in CUBE_SIZES"
            :key="option"
            type="button"
            role="radio"
            class="border-zinc-500 px-3 py-1 [&:not(:first-child)]:border-l"
            :class="size === option ? 'bg-zinc-800 text-zinc-50' : 'bg-white text-zinc-800'"
            :aria-checked="size === option"
            :disabled="model === null"
            :data-testid="`export-size-${String(option)}`"
            @click="onSize(option)"
          >
            {{
              t(option === DEFAULT_SIZE ? 'export.lut.sizeDefault' : 'export.lut.sizeOption', {
                size: option,
              })
            }}
          </button>
        </div>
        <LutSlices :model="model" />
        <p v-if="model === null" class="text-xs text-zinc-700" data-testid="export-no-model">
          <strong>{{ t('export.lut.noModelTitle') }}</strong> {{ t('export.lut.noModelText') }}
          <button type="button" class="underline" @click="emit('goto', 'color')">
            {{ t('export.lut.gotoColor') }}
          </button>
        </p>
        <div
          class="mt-auto flex flex-wrap items-center gap-3 rounded-lg border border-zinc-300 bg-white p-3"
        >
          <span
            aria-hidden="true"
            class="grid h-10 w-8 place-items-end justify-items-center rounded border-[1.5px] border-zinc-500 bg-white pb-0.5 text-[8px] font-bold"
            >.cube</span
          >
          <div class="text-sm">
            <p class="font-semibold">{{ fileName }}</p>
            <p class="text-xs text-zinc-500" data-testid="export-file-info">{{ fileInfo }}</p>
          </div>
          <button
            type="button"
            class="ml-auto rounded bg-emerald-700 px-3 py-1 text-sm text-white disabled:bg-zinc-300 disabled:text-zinc-500"
            :disabled="model === null"
            data-testid="export-download"
            @click="download"
          >
            {{ t('export.lut.download', { file: fileName }) }}
          </button>
        </div>
      </article>

      <article
        class="flex flex-col gap-2 rounded-lg border border-zinc-300 bg-zinc-50 p-3"
        aria-labelledby="project-heading"
      >
        <h2 id="project-heading" class="text-sm font-semibold">
          {{ t('export.project.heading') }}
        </h2>
        <I18nT keypath="export.project.description" tag="p" class="text-xs text-zinc-600">
          <template #file><code>.json</code></template>
        </I18nT>
        <dl class="text-sm" data-testid="project-facts">
          <div
            v-for="fact in facts"
            :key="fact.label"
            class="flex justify-between gap-3 border-b border-dashed border-zinc-300 py-1.5 text-xs"
          >
            <dt class="text-zinc-500">{{ fact.label }}</dt>
            <dd class="text-right">{{ fact.value }}</dd>
          </div>
        </dl>
        <div class="mt-auto pt-1">
          <ProjectBar />
        </div>
      </article>
    </div>
  </section>
</template>
