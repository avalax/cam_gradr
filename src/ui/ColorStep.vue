<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onMounted } from 'vue';

import { useColorChartStore } from '../chart/chart-store';
import { NEUTRAL_IDS, colorLayout } from '../chart/layouts';
import { BUNDLED_NAME, BUNDLED_SOURCE_URL } from '../reference/bundled';
import { useReferenceStore } from '../reference/reference-store';
import { useSolveStore } from '../solve/solve-store';

import CardStage from './CardStage.vue';
import ResultReport from './ResultReport.vue';

const chart = useColorChartStore();
const references = useReferenceStore();
const solve = useSolveStore();
const { ready, measurements } = storeToRefs(chart);
const { sets, selected, error, warning, lastSaved, lastRemoved } = storeToRefs(references);
const { result, error: solveError } = storeToRefs(solve);

const CARD_NAMES = {
  1: 'linke Farbkarte (Spalten A–D)',
  2: 'rechte Farbkarte (Spalten E–H)',
};
const IDLE_TEXT =
  'Beide Farbkarten ruhig vor die Kamera halten und ein Standbild aufnehmen. Die Eckpunkte werden danach auf dem Standbild gesetzt.';

const canCompute = computed(
  () => ready.value && selected.value !== null && Object.keys(measurements.value).length > 0,
);

onMounted(() => {
  void references.load();
});

async function onFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file !== undefined) {
    await references.importFile(file.name, await file.text());
  }
  // Dieselbe Datei soll sich erneut wählen lassen.
  input.value = '';
}

function onSelect(event: Event): void {
  references.select((event.target as HTMLSelectElement).value);
}

function compute(): void {
  if (selected.value !== null) {
    solve.compute({
      measurements: measurements.value,
      reference: selected.value,
      neutralIds: NEUTRAL_IDS,
    });
  }
}
</script>

<template>
  <section class="space-y-4">
    <div class="lg:grid lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start lg:gap-6">
      <aside class="space-y-3 pb-4 lg:col-start-2 lg:row-start-1 lg:pb-0">
        <p class="text-sm text-slate-700">
          Dieser Tab berechnet die Farbkorrektur. Lade zuerst die Referenzwerte deiner Karten: den
          mitgelieferten Satz oder eine eigene Datei (sie bleibt auf deinem Rechner und wird nur
          lokal im Browser gespeichert). Nimm dann ein Standbild der beiden Farbkarten auf, markiere
          die Eckpunkte und starte die Berechnung.
        </p>

        <div class="space-y-2 rounded border border-slate-300 p-3">
          <h2 class="text-sm font-semibold">Referenzwerte</h2>
          <div class="flex flex-wrap items-end gap-3">
            <label class="flex flex-col text-sm">
              Datei importieren (JSON oder CSV)
              <input
                type="file"
                accept=".json,.csv,application/json,text/csv"
                class="text-sm"
                data-testid="reference-file"
                @change="onFile"
              />
            </label>
            <label v-if="sets.length > 0" class="flex flex-col text-sm">
              Gespeicherter Satz
              <select
                class="rounded border p-1"
                :value="selected?.name"
                data-testid="reference-select"
                @change="onSelect"
              >
                <option v-for="set in sets" :key="set.name" :value="set.name">
                  {{ set.name }}
                </option>
              </select>
            </label>
            <button
              v-if="selected !== null"
              type="button"
              class="rounded border px-3 py-1 text-sm"
              @click="references.remove(selected.name)"
            >
              Satz löschen
            </button>
            <button
              v-if="selected !== null"
              type="button"
              class="rounded border px-3 py-1 text-sm"
              data-testid="reference-download"
              @click="references.downloadSelected()"
            >
              Satz herunterladen
            </button>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              class="rounded border px-3 py-1 text-sm"
              data-testid="reference-bundled"
              @click="references.importBundled()"
            >
              Mitgelieferten Satz laden
            </button>
          </div>
          <p class="text-xs text-slate-600" data-testid="reference-source">
            „{{ BUNDLED_NAME }}“ stammt aus dem Blogbeitrag
            <a
              :href="BUNDLED_SOURCE_URL"
              class="underline"
              target="_blank"
              rel="noopener noreferrer"
              >bartneck.de</a
            >
            und ist keine Datei von Datacolor. Abweichungen zur eigenen Karte sind möglich.
          </p>
          <p v-if="selected === null" class="text-sm text-amber-800" data-testid="reference-hint">
            Noch keine Referenzwerte geladen. Format: JSON mit
            <code>cam_gradr-reference/1</code> oder CSV mit den Spalten id, L, a, b (Lab, D50).
          </p>
          <p v-else class="text-sm text-slate-700" data-testid="reference-active">
            Aktiv: {{ selected.name }} ({{ Object.keys(selected.patches).length }} Felder)
          </p>
          <p
            v-if="selected !== null && lastSaved === selected.name"
            class="text-xs text-slate-600"
            data-testid="reference-saved"
          >
            Lokal im Browser gespeichert.
          </p>
          <p
            v-if="lastRemoved !== null"
            class="text-xs text-slate-600"
            data-testid="reference-removed"
          >
            Satz „{{ lastRemoved }}“ lokal gelöscht.
          </p>
          <p v-if="error !== null" class="text-sm text-red-700" role="alert">{{ error }}</p>
          <p v-if="warning !== null" class="text-sm text-amber-800" role="status">{{ warning }}</p>
        </div>
      </aside>

      <div class="min-w-0 lg:col-start-1 lg:row-start-1">
        <CardStage
          :store="chart"
          :layout="colorLayout"
          :card-names="CARD_NAMES"
          :idle-text="IDLE_TEXT"
          :live-measure="false"
        >
          <template #actions>
            <button
              type="button"
              class="rounded bg-slate-800 px-3 py-1 text-sm text-white disabled:opacity-50"
              :disabled="!canCompute"
              @click="compute"
            >
              Farbkorrektur berechnen
            </button>
          </template>
        </CardStage>
      </div>
    </div>

    <p v-if="solveError !== null" class="text-sm text-red-700" role="alert">{{ solveError }}</p>
    <ResultReport v-if="result !== null" :result="result" />
  </section>
</template>
