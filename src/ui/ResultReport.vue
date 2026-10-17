<script setup lang="ts">
import { computed } from 'vue';

import { labToSrgb } from '../color/lab';
import { applyColorModel } from '../solve/fit';
import type { FitResult } from '../solve/fit';
import type { GrayCheck } from '../solve/gray-check';

import { cssColor } from './color-css';

const props = withDefaults(defineProps<{ result: FitResult; grayCheck?: readonly GrayCheck[] }>(), {
  grayCheck: () => [],
});

// Ab diesem Fehler (ΔE2000) auf den Graukarten weist der Bericht auf mögliche Ursachen hin.
const GRAY_WARN = 3;
const GRAY_NAMES: Readonly<Record<string, string>> = {
  G50: 'Graukarte 50 %',
  G18: 'Graukarte 18 %',
};

const grayRows = computed(() =>
  props.grayCheck.map((check) => ({ ...check, name: GRAY_NAMES[check.id] ?? check.id })),
);
const grayOff = computed(() => props.grayCheck.some((check) => check.after > GRAY_WARN));

function format(value: number): string {
  return value.toFixed(1);
}

// Pro Feld: Soll-Farbe, Kamerawert und korrigierter Wert als Farbfelder samt Fehler.
const tiles = computed(() =>
  props.result.report.patches.map((patch) => ({
    ...patch,
    referenceCss: cssColor(labToSrgb(patch.reference)),
    cameraCss: cssColor(patch.measured),
    correctedCss: cssColor(applyColorModel(props.result.model, patch.measured)),
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
      <template v-if="result.report.neutral !== null">
        <dd>Neutralfelder ({{ result.report.neutral.count }}), Mittel</dd>
        <dd data-testid="neutral-before">{{ format(result.report.neutral.meanBefore) }}</dd>
        <dd data-testid="neutral-after">{{ format(result.report.neutral.meanAfter) }}</dd>
      </template>
      <template v-if="result.report.color !== null">
        <dd>Farbfelder ({{ result.report.color.count }}), Mittel</dd>
        <dd data-testid="color-before">{{ format(result.report.color.meanBefore) }}</dd>
        <dd data-testid="color-after">{{ format(result.report.color.meanAfter) }}</dd>
      </template>
    </dl>

    <p
      v-if="result.report.indistinct.length > 0"
      class="max-w-xl text-sm text-amber-800"
      role="note"
      data-testid="indistinct-warning"
    >
      Die Kamera unterscheidet die hellsten Neutralfelder ({{
        result.report.indistinct.join(', ')
      }}) kaum: Ihre Lichter sind komprimiert oder gekappt. Das lässt sich in der Korrektur nicht
      ausgleichen. Schalte besser Automatiken der Kamera aus (HDR, Lichtkorrektur, automatische
      Belichtung) und stelle die Belichtung fest ein.
    </p>

    <section v-if="grayRows.length > 0" class="max-w-xl space-y-1 text-sm" data-testid="gray-check">
      <h4 class="font-medium">Kontrolle mit den Graukarten</h4>
      <p class="text-xs text-slate-600">
        Die großen Felder der Graukarten gehen nicht in die Berechnung ein. Ihre Abweichung vom
        Nennwert (ΔE2000, vorher → nachher) zeigt unabhängig, ob die Korrektur auch dort stimmt.
      </p>
      <ul>
        <li v-for="row in grayRows" :key="row.id" :data-testid="`gray-${row.id}`">
          {{ row.name }}: {{ format(row.before) }} → {{ format(row.after) }}
        </li>
      </ul>
      <p v-if="grayOff" class="text-xs text-amber-800" role="note" data-testid="gray-warning">
        Die Abweichung ist groß. Möglicherweise haben sich Licht oder die Automatik der Kamera
        zwischen den Aufnahmen der Graukarten und der Farbkarten geändert, oder die Nennwerte der
        Graukarten stimmen nicht genau.
      </p>
    </section>

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
