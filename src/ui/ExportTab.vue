<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, ref } from 'vue';
import { I18nT, useI18n } from 'vue-i18n';

import { useChartStore, useColorChartStore } from '../chart/chart-store';
import { lookedLut } from '../look/look';
import { useLookStore } from '../look/look-store';
import { CUBE_SIZES, formatCube } from '../lut/cube';
import { downloadFile } from '../lut/download';
import { buildLut } from '../lut/lut';
import { FULL_STRENGTH, usePreviewStore } from '../lut/preview-store';
import { useReferenceStore } from '../reference/reference-store';
import { useSolveStore } from '../solve/solve-store';

import { exportFileName, exportNotes, exportTitle } from './export-file';
import type { ExportLook } from './export-file';
import LutSlices from './LutSlices.vue';
import ProjectBar from './ProjectBar.vue';
import { cubeSizeText } from './lut-slices';

const emit = defineEmits<{ goto: [tab: 'color' | 'preview'] }>();

// What the file holds: the correction alone or with the look LUT chosen in the preview.
const CONTENTS = ['plain', 'look'] as const;

const DEFAULT_SIZE = 33;

const { t } = useI18n();

const solve = useSolveStore();
const { model } = storeToRefs(solve);
const { selected } = storeToRefs(useReferenceStore());
const gray = useChartStore();
const color = useColorChartStore();
const preview = usePreviewStore();
const looks = useLookStore();

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
  {
    label: t('export.project.look'),
    value:
      preview.look === null
        ? '–'
        : t('export.project.lookValue', { name: preview.look, strength: preview.strength }),
  },
]);
const size = ref<number>(DEFAULT_SIZE);
const content = ref<(typeof CONTENTS)[number]>('look');

// The look goes into the file when it is chosen in the preview and the content asks for it.
const chosen = computed(() => looks.find(preview.look));
const exportLook = computed<ExportLook | null>(() =>
  content.value === 'look' && chosen.value !== null
    ? { name: chosen.value.name, strength: preview.strength }
    : null,
);
// The content the file really gets: without a look chosen in the preview it is the correction alone,
// whatever `content` asks for.
const contained = computed(() => (exportLook.value === null ? 'plain' : 'look'));
// The line under the choice names the look in the file, the plain correction, or where to choose a
// look.
const lookLine = computed(() => {
  if (exportLook.value !== null) {
    return 'export.lut.lookLine';
  }
  return chosen.value === null ? 'export.lut.noLook' : 'export.lut.plainLine';
});
const sliceLook = computed(() =>
  exportLook.value === null || chosen.value === null
    ? null
    : { lut: chosen.value, amount: preview.strength / FULL_STRENGTH },
);
const fileName = computed(() => exportFileName(size.value, exportLook.value));
const fileInfo = computed(
  () =>
    `${String(size.value)} × ${String(size.value)} × ${String(size.value)} · ${cubeSizeText(size.value)}`,
);

function download(): void {
  const current = model.value;
  if (current !== null) {
    const lut = lookedLut(
      buildLut(current, size.value),
      exportLook.value === null ? null : chosen.value,
      preview.strength / FULL_STRENGTH,
    );
    downloadFile(
      fileName.value,
      formatCube(lut, exportTitle(exportLook.value), exportNotes(exportLook.value)),
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
        <!-- Content and size in one row, so that the export stays as tall as the other tabs. -->
        <div class="flex flex-wrap gap-2">
          <div
            role="radiogroup"
            :aria-label="t('export.lut.content')"
            class="inline-flex w-fit overflow-hidden rounded-md border border-zinc-500 text-sm"
            :class="{ 'opacity-50': model === null }"
          >
            <button
              v-for="option in CONTENTS"
              :key="option"
              type="button"
              role="radio"
              class="border-zinc-500 px-3 py-1 [&:not(:first-child)]:border-l disabled:text-zinc-500"
              :class="
                contained === option
                  ? 'bg-zinc-800 text-zinc-50'
                  : 'bg-white dark:bg-zinc-100 text-zinc-800'
              "
              :aria-checked="contained === option"
              :disabled="model === null || (option === 'look' && chosen === null)"
              :data-testid="`export-content-${option}`"
              @click="content = option"
            >
              {{ t(option === 'look' ? 'export.lut.contentLook' : 'export.lut.contentPlain') }}
            </button>
          </div>
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
              :class="
                size === option
                  ? 'bg-zinc-800 text-zinc-50'
                  : 'bg-white dark:bg-zinc-100 text-zinc-800'
              "
              :aria-checked="size === option"
              :disabled="model === null"
              :data-testid="`export-size-${String(option)}`"
              @click="size = option"
            >
              {{
                t(option === DEFAULT_SIZE ? 'export.lut.sizeDefault' : 'export.lut.sizeOption', {
                  size: option,
                })
              }}
            </button>
          </div>
        </div>
        <I18nT :keypath="lookLine" tag="p" class="text-xs text-zinc-700" data-testid="export-look">
          <template #name>{{ exportLook?.name }}</template>
          <template #strength>{{ exportLook?.strength }}</template>
          <template #preview>
            <button type="button" class="underline" @click="emit('goto', 'preview')">
              {{ t('export.lut.previewLink') }}
            </button>
          </template>
        </I18nT>
        <LutSlices :model="model" :look="sliceLook" />
        <p v-if="model === null" class="text-xs text-zinc-700" data-testid="export-no-model">
          <strong>{{ t('export.lut.noModelTitle') }}</strong> {{ t('export.lut.noModelText') }}
          <button type="button" class="underline" @click="emit('goto', 'color')">
            {{ t('export.lut.gotoColor') }}
          </button>
        </p>
        <div
          class="mt-auto flex flex-wrap items-center gap-3 rounded-lg border border-zinc-300 bg-white dark:bg-zinc-100 p-3"
        >
          <span
            aria-hidden="true"
            class="grid h-10 w-8 place-items-end justify-items-center rounded border-[1.5px] border-zinc-500 bg-white dark:bg-zinc-100 pb-0.5 text-[8px] font-bold"
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
        <p class="text-[11px] leading-snug text-zinc-500">{{ t('export.project.lookNote') }}</p>
        <div class="mt-auto pt-1">
          <ProjectBar />
        </div>
      </article>
    </div>
  </section>
</template>
