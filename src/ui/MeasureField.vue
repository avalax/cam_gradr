<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import type { ExposureResult } from '../chart/exposure';

import type { Edge } from './measure-field';
import {
  detailCaption,
  detailRows,
  fieldHint,
  fieldPosition,
  mainIssue,
  okBox,
} from './measure-field';

const props = defineProps<{ exposure: ExposureResult | null }>();
const { t } = useI18n();

// The message sits at the edge of the field the measurement deviates towards: dark line with gray label.
const EDGE_CLASSES: Readonly<Record<Edge, string>> = {
  top: 'inset-x-0 top-0 border-b-(length:--band-line)',
  bottom: 'inset-x-0 bottom-0 border-t-(length:--band-line)',
  left: 'inset-y-0 left-0 border-r-[3px] [writing-mode:vertical-rl] rotate-180',
  right: 'inset-y-0 right-0 border-l-[3px] [writing-mode:vertical-rl]',
};

// Five fine gray levels vertically (light = brightness too high, dark = too low), similar to the
// zone system of photography.
const BANDS = ['#fafafa', '#e9e9ec', '#d2d2d7', '#b7b7be', '#9a9aa2'] as const;
// To the left the area gets lighter and flatter, to the right darker and higher in contrast.
const CONTRAST_SHADE =
  'linear-gradient(to right, rgba(255,255,255,.28), rgba(255,255,255,0) 35%, rgba(0,0,0,0) 65%, rgba(0,0,0,.14))';

const box = okBox();
const boxStyle = {
  left: `${String(box.left)}%`,
  top: `${String(box.top)}%`,
  width: `${String(box.width)}%`,
  height: `${String(box.height)}%`,
};
const caption = computed(() => detailCaption());
const hint = computed(() => fieldHint(props.exposure));
const issue = computed(() => mainIssue(props.exposure));
const markerStyle = computed(() => {
  if (props.exposure === null) {
    return null;
  }
  const { left, top } = fieldPosition(props.exposure);
  return { left: `${String(left)}%`, top: `${String(top)}%` };
});
const rows = computed(() => (props.exposure === null ? [] : detailRows(props.exposure)));
</script>

<template>
  <!-- Measuring field as tall as the camera image: brightness vertically, contrast horizontally; details on hover or keyboard focus. -->
  <div class="flex w-44 shrink-0 flex-col self-stretch">
    <div
      class="group relative min-h-0 w-full flex-1 rounded-lg border border-zinc-500 outline-offset-2 focus-visible:outline"
      tabindex="0"
      role="img"
      :aria-label="t('measure.aria', { hint })"
      data-testid="measure-field"
    >
      <div class="absolute inset-0 overflow-hidden rounded-[inherit]">
        <div class="flex h-full flex-col">
          <div v-for="band in BANDS" :key="band" class="flex-1" :style="{ background: band }"></div>
        </div>
        <div class="absolute inset-0" :style="{ background: CONTRAST_SHADE }"></div>

        <!-- Normal range: brightness and contrast may deviate this far from the target. -->
        <div
          class="pointer-events-none absolute rounded-sm border-2 border-zinc-900 bg-white/20 ring-2 ring-white/70"
          :class="exposure === null ? 'opacity-40' : ''"
          :style="boxStyle"
          data-testid="measure-ok-box"
        ></div>

        <!-- Most important message at the edge the measurement deviates towards. -->
        <div
          v-if="issue !== null"
          class="absolute flex items-center justify-center border-zinc-700 text-center bg-zinc-200 px-2 py-1.5 text-xs font-semibold leading-tight text-zinc-800"
          :class="EDGE_CLASSES[issue.edge]"
          :data-edge="issue.edge"
          data-testid="measure-issue"
        >
          {{ issue.label }}
        </div>
      </div>

      <div
        v-if="markerStyle !== null"
        class="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-zinc-900 bg-white shadow"
        :style="markerStyle"
        data-testid="measure-marker"
      ></div>

      <div
        class="pointer-events-none absolute right-full top-0 z-10 mr-3 hidden w-80 rounded bg-slate-900 p-3 text-sm text-white shadow-lg group-focus:block group-hover:block"
        role="tooltip"
        data-testid="measure-details"
      >
        <p class="font-medium" data-testid="measure-hint">{{ hint }}</p>
        <p v-if="rows.length > 0" class="mt-2 text-xs text-slate-300">{{ caption }}</p>
        <dl v-if="rows.length > 0" class="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <template v-for="row in rows" :key="row.label">
            <dt class="text-slate-300">{{ row.label }}</dt>
            <dd>{{ row.value }}</dd>
          </template>
        </dl>
      </div>
    </div>
  </div>
</template>
