<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { I18nT, useI18n } from 'vue-i18n';

import { useChartStore, useColorChartStore } from '../chart/chart-store';
import { lookedLut } from '../look/look';
import { useLookStore } from '../look/look-store';
import { CUBE_SIZES, formatCube } from '../lut/cube';
import type { CubeSize } from '../lut/cube';
import { downloadFile } from '../lut/download';
import { useExportStore } from '../lut/export-store';
import { buildLut } from '../lut/lut';
import { FULL_STRENGTH, usePreviewStore } from '../lut/preview-store';
import { useReferenceStore } from '../reference/reference-store';
import { useSolveStore } from '../solve/solve-store';

import { exportFileName, exportNotes, exportTitle } from './export-file';
import type { ExportLook } from './export-file';
import LutSlices from './LutSlices.vue';
import ChoiceChips from './ChoiceChips.vue';
import { LINK_BUTTON } from './control-styles';
import ProjectBar from './ProjectBar.vue';
import { cubeSizeText } from './lut-slices';

const emit = defineEmits<{ goto: [tab: 'color'] }>();

// What each size is for, under its file size.
const SIZE_HINTS = {
  17: 'export.lut.hintSmall',
  33: 'export.lut.hintDefault',
  65: 'export.lut.hintLarge',
} as const satisfies Record<CubeSize, string>;

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
// The size is kept in a store, so that a project file can save it.
const exportSettings = useExportStore();
const { size } = storeToRefs(exportSettings);

// The file takes the look LUT the preview shows, at its strength.
const chosen = computed(() => looks.find(preview.look));
const exportLook = computed<ExportLook | null>(() =>
  chosen.value === null ? null : { name: chosen.value.name, strength: preview.strength },
);
const sizeOptions = computed(() =>
  CUBE_SIZES.map((option) => ({
    key: String(option),
    value: option,
    label: t('export.lut.sizeOption', { size: option }),
    detail: cubeSizeText(option),
    hint: t(SIZE_HINTS[option]),
  })),
);
const sliceLook = computed(() =>
  chosen.value === null ? null : { lut: chosen.value, amount: preview.strength / FULL_STRENGTH },
);
const fileName = computed(() => exportFileName(size.value, exportLook.value));
const fileInfo = computed(() => t('export.lut.points', { size: size.value }));

function download(): void {
  const current = model.value;
  if (current !== null) {
    const lut = lookedLut(
      buildLut(current, size.value),
      chosen.value,
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
  <!-- On the grid of the other tabs: the LUT where their image is (it ends where the image ends),
       the project where their side column and their text column are (11 rem, a gap of 1.5 rem and
       21 rem). -->
  <section class="grid flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_33.5rem]">
    <!-- Without color correction you see what you would get: same layout, but grayed out. -->
    <article
      class="flex min-w-0 flex-col gap-2 rounded-lg border p-3"
      :class="
        model === null ? 'border-dashed border-zinc-300 bg-zinc-100' : 'border-zinc-300 bg-zinc-50'
      "
      aria-labelledby="lut-heading"
    >
      <h2 id="lut-heading" class="text-sm font-semibold">{{ t('export.lut.heading') }}</h2>
      <I18nT keypath="export.lut.description" tag="p" class="text-xs text-zinc-600">
        <template #file><code>.cube</code></template>
      </I18nT>
      <p v-if="model === null" class="text-xs text-zinc-700" data-testid="export-no-model">
        <span class="block font-semibold">{{ t('export.lut.noModelTitle') }}</span>
        {{ t('export.lut.noModelText') }}
        <button type="button" :class="LINK_BUTTON" @click="emit('goto', 'color')">
          {{ t('export.lut.gotoColor') }}
        </button>
      </p>
      <!-- The slices take the room the card has (it is as tall as the other tabs), as large as fits
           in width and height; they never make the card taller. -->
      <div class="min-h-24 flex-1 [container-type:size]">
        <LutSlices
          class="one-row:w-[min(100cqw,calc(400cqh_+_1.5rem))] two-rows:w-[min(100cqw,calc(200cqh_+_0.5rem))]"
          :model="model"
          :look="sliceLook"
        />
      </div>
      <div
        class="flex flex-col gap-3 rounded-lg border border-zinc-300 bg-white dark:bg-zinc-100 p-3"
      >
        <!-- The three sizes, each with its file size and what it is for. -->
        <ChoiceChips
          variant="cards"
          :options="sizeOptions"
          :selected="String(size)"
          :disabled="model === null"
          :aria-label="t('export.lut.sizeLabel')"
          data-testid="export-size"
          @choose="exportSettings.setSize($event)"
        />
        <div class="flex flex-wrap items-center gap-3">
          <span
            aria-hidden="true"
            class="grid h-10 w-8 place-items-end justify-items-center rounded border-[1.5px] border-zinc-500 bg-white dark:bg-zinc-100 pb-0.5 text-[8px] font-bold"
            >.cube</span
          >
          <div class="min-w-0 text-sm">
            <p id="export-file-name" class="truncate font-semibold">{{ fileName }}</p>
            <p class="text-xs text-zinc-500" data-testid="export-file-info">{{ fileInfo }}</p>
          </div>
          <!-- The file name stands beside the button, so it is not repeated in the button. -->
          <button
            type="button"
            class="ml-auto rounded bg-emerald-700 px-3 py-1 text-sm text-white enabled:hover:bg-emerald-800 disabled:bg-zinc-300 disabled:text-zinc-500"
            :disabled="model === null"
            aria-describedby="export-file-name"
            data-testid="export-download"
            @click="download"
          >
            {{ t('export.lut.download') }}
          </button>
        </div>
      </div>
    </article>

    <article
      class="flex min-w-0 flex-col gap-2 rounded-lg border border-zinc-300 bg-zinc-50 p-3"
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
  </section>
</template>
