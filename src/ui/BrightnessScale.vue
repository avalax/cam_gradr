<script setup lang="ts">
import { computed } from 'vue';

import type { ExposureResult } from '../chart/exposure';

import { detailRows, okBand, scaleGradient, scalePosition, summary } from './brightness-scale';

const props = defineProps<{ exposure: ExposureResult | null }>();

const gradient = scaleGradient();
const band = okBand();
const bandStyle = { top: `${String(band.from)}%`, height: `${String(band.to - band.from)}%` };
const text = computed(() => summary(props.exposure));
const markerTop = computed(() =>
  props.exposure === null ? null : `${String(scalePosition(props.exposure.delta))}%`,
);
const rows = computed(() => (props.exposure === null ? [] : detailRows(props.exposure)));
</script>

<template>
  <!-- Senkrechte Helligkeitsskala; Details erscheinen beim Überfahren oder per Tastaturfokus. -->
  <div
    class="group relative w-7 shrink-0 self-stretch rounded outline-offset-2 focus-visible:outline"
    tabindex="0"
    role="img"
    :aria-label="`Raumhelligkeit: ${text}`"
    data-testid="brightness-scale"
  >
    <div
      class="absolute inset-0 rounded border border-slate-500"
      :style="{ background: gradient }"
      :class="exposure === null ? 'opacity-40' : ''"
    ></div>

    <!-- Zielbereich: so weit darf die Helligkeit vom Sollwert abweichen. -->
    <div
      class="pointer-events-none absolute inset-x-0 border-y-2 border-slate-900 bg-white/25"
      :class="exposure === null ? 'opacity-40' : ''"
      :style="bandStyle"
      data-testid="scale-ok-band"
    ></div>

    <div
      v-if="exposure?.highlightsClipped"
      class="absolute inset-x-0 top-0 h-2 rounded-t border-b-2 border-slate-900 bg-white"
      data-testid="scale-clipped-top"
    ></div>
    <div
      v-if="exposure?.shadowsCrushed"
      class="absolute inset-x-0 bottom-0 h-2 rounded-b border-t-2 border-white bg-black"
      data-testid="scale-crushed-bottom"
    ></div>

    <div
      v-if="markerTop !== null"
      class="pointer-events-none absolute -left-1 -right-1 h-1 -translate-y-1/2 rounded bg-white shadow ring-2 ring-slate-900"
      :style="{ top: markerTop }"
      data-testid="scale-marker"
    ></div>

    <div
      class="pointer-events-none absolute right-9 top-0 z-10 hidden w-64 rounded bg-slate-900 p-3 text-sm text-white shadow-lg group-focus:block group-hover:block"
      role="tooltip"
      data-testid="scale-details"
    >
      <p class="font-medium">{{ text }}</p>
      <dl v-if="rows.length > 0" class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
        <template v-for="row in rows" :key="row.label">
          <dt class="text-slate-300">{{ row.label }}</dt>
          <dd>{{ row.value }}</dd>
        </template>
      </dl>
    </div>
  </div>
</template>
