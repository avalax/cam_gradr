<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, ref } from 'vue';

import { CUBE_SIZES, formatCube } from '../lut/cube';
import { downloadFile } from '../lut/download';
import { buildLut } from '../lut/lut';
import { useSolveStore } from '../solve/solve-store';

const DEFAULT_SIZE = 33;

const solve = useSolveStore();
const { model } = storeToRefs(solve);

const size = ref<number>(DEFAULT_SIZE);
const savedAs = ref<string | null>(null);

const fileName = computed(() => `cam_gradr-${String(size.value)}.cube`);

function onSize(event: Event): void {
  size.value = Number((event.target as HTMLSelectElement).value);
  savedAs.value = null;
}

function download(): void {
  const current = model.value;
  if (current !== null) {
    downloadFile(
      fileName.value,
      formatCube(buildLut(current, size.value), 'cam_gradr'),
      'text/plain',
    );
    savedAs.value = fileName.value;
  }
}
</script>

<template>
  <section class="max-w-2xl space-y-4">
    <p class="text-sm text-slate-700">
      Hier exportierst du die Farbkorrektur als 3D-LUT im Format <code>.cube</code>. Die Datei lässt
      sich zum Beispiel in einen Kameramonitor oder in eine Videosoftware laden.
    </p>

    <p v-if="model === null" class="text-sm text-amber-800" data-testid="export-no-model">
      Es gibt noch keine Farbkorrektur. Berechne sie zuerst im Tab „Farbkarten“ oder lade ein
      Projekt.
    </p>

    <template v-else>
      <label class="flex flex-col gap-1 text-sm">
        Größe der LUT (Stützstellen je Achse)
        <select
          class="w-48 rounded border p-1"
          :value="size"
          data-testid="export-size"
          @change="onSize"
        >
          <option v-for="option in CUBE_SIZES" :key="option" :value="option">
            {{ option }}³{{ option === DEFAULT_SIZE ? ' (Standard)' : '' }}
          </option>
        </select>
      </label>
      <p class="text-xs text-slate-600">
        Welche Größe dein Gerät annimmt, steht in dessen Handbuch. Größere LUTs sind genauer, aber
        manche Geräte unterstützen nur 17³ oder 33³.
      </p>

      <div class="flex flex-wrap items-center gap-3">
        <button
          type="button"
          class="rounded bg-emerald-700 px-3 py-1 text-sm text-white"
          data-testid="export-download"
          @click="download"
        >
          LUT herunterladen ({{ fileName }})
        </button>
        <p
          v-if="savedAs !== null"
          class="text-sm text-slate-700"
          role="status"
          data-testid="export-saved"
        >
          Heruntergeladen als {{ savedAs }}.
        </p>
      </div>
    </template>
  </section>
</template>
