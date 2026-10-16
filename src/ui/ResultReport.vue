<script setup lang="ts">
import { computed } from 'vue';

import { labToSrgb } from '../color/lab';
import type { Vec3 } from '../color/lab';
import { applyColorModel } from '../solve/fit';
import type { FitResult } from '../solve/fit';

const props = defineProps<{ result: FitResult }>();

const MAX_CODE = 255;

function css(code: Vec3): string {
  const [r, g, b] = code.map((value) => Math.round(value * MAX_CODE));
  return `rgb(${String(r)}, ${String(g)}, ${String(b)})`;
}

function format(value: number): string {
  return value.toFixed(1);
}

// Pro Feld: Soll-Farbe, Kamerawert und korrigierter Wert als Farbfelder samt Fehler.
const tiles = computed(() =>
  props.result.report.patches.map((patch) => ({
    ...patch,
    referenceCss: css(labToSrgb(patch.reference)),
    cameraCss: css(patch.measured),
    correctedCss: css(applyColorModel(props.result.model, patch.measured)),
  })),
);
</script>

<template>
  <section class="space-y-3" data-testid="report">
    <h3 class="text-lg font-semibold">Ergebnis der Farbkorrektur</h3>
    <dl class="grid max-w-xl grid-cols-3 gap-x-4 gap-y-1 text-sm" data-testid="report-summary">
      <dt class="font-medium"></dt>
      <dt class="font-medium">Vorher</dt>
      <dt class="font-medium">Nachher</dt>
      <dd>Mittlerer Fehler (ΔE2000)</dd>
      <dd data-testid="mean-before">{{ format(result.report.meanBefore) }}</dd>
      <dd data-testid="mean-after">{{ format(result.report.meanAfter) }}</dd>
      <dd>Größter Fehler (ΔE2000)</dd>
      <dd data-testid="max-before">{{ format(result.report.maxBefore) }}</dd>
      <dd data-testid="max-after">{{ format(result.report.maxAfter) }}</dd>
    </dl>

    <p class="max-w-4xl text-xs text-slate-600">
      Je Feld: links Soll-Farbe, Mitte Kamera, rechts korrigiert. Unter dem Feld steht der Fehler
      vorher → nachher (ΔE2000, unter etwa 2 kaum sichtbar).
    </p>

    <ul class="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-2">
      <li
        v-for="tile in tiles"
        :key="tile.id"
        class="rounded border border-slate-300 p-1 text-center text-xs"
        :data-testid="`tile-${tile.id}`"
        :title="`${tile.id}: ΔE ${format(tile.before)} → ${format(tile.after)}`"
      >
        <div class="flex h-8 overflow-hidden rounded">
          <span class="flex-1" :style="{ background: tile.referenceCss }"></span>
          <span class="flex-1" :style="{ background: tile.cameraCss }"></span>
          <span class="flex-1" :style="{ background: tile.correctedCss }"></span>
        </div>
        <span class="mt-1 block"
          >{{ tile.id }}: {{ format(tile.before) }} → {{ format(tile.after) }}</span
        >
      </li>
    </ul>
  </section>
</template>
