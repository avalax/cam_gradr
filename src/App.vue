<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';

import { useCameraStore } from './camera/camera-store';
import { useChartStore } from './chart/chart-store';
import { useReferenceStore } from './reference/reference-store';
import { useSolveStore } from './solve/solve-store';
import CameraToggle from './ui/CameraToggle.vue';
import ColorStep from './ui/ColorStep.vue';
import ExportTab from './ui/ExportTab.vue';
import GrayStep from './ui/GrayStep.vue';
import PreviewTab from './ui/PreviewTab.vue';
import ProjectStatus from './ui/ProjectStatus.vue';
import SettingsMenu from './ui/SettingsMenu.vue';
import StatusGauge from './ui/StatusGauge.vue';
import { APP_ID, APP_NAME } from './ui/app-info';
import { trackHeight } from './ui/panel-height';
import { colorStatus, grayStatus } from './ui/tab-status';
import type { TabStatus } from './ui/tab-status';

type TabKey = 'gray' | 'color' | 'preview' | 'export';

// Jeder Tab nennt unter seinem Namen kurz sein Ergebnis; Vorschau und Export haben einen festen Text.
const TABS: readonly { key: TabKey; label: string; hint: string }[] = [
  { key: 'gray', label: 'Graukarten', hint: '' },
  { key: 'color', label: 'Farbkarten', hint: '' },
  { key: 'preview', label: 'Vorschau', hint: 'Original / korrigiert' },
  { key: 'export', label: 'Export', hint: '.cube, Projekt' },
];

const tab = ref<TabKey>('gray');
const camera = useCameraStore();
const { exposure } = storeToRefs(useChartStore());
const { result } = storeToRefs(useSolveStore());

// Status der beiden Messtabs: Er folgt dem Ergebnis (Licht im Normalbereich, Abweichung nach der
// Korrektur), nicht dem bloßen Bearbeiten.
const statuses = computed<Partial<Record<TabKey, TabStatus>>>(() => ({
  gray: grayStatus(exposure.value),
  color: colorStatus(result.value?.report ?? null),
}));
const entries = computed(() =>
  TABS.map((entry) => {
    const status = statuses.value[entry.key] ?? null;
    return { ...entry, status, text: status?.text ?? entry.hint };
  }),
);

// Der mitgelieferte Referenzsatz und die lokal gespeicherten Sätze stehen von Anfang an bereit.
onMounted(() => {
  void useReferenceStore().load();
});

// Jeder Tab mit Kamerabild (Grau-, Farbkarten, Vorschau) hat sein eigenes Standbild: Beim Wechsel
// wird es abgelegt und beim Zurückkommen wieder angezeigt. Der Export zeigt kein Kamerabild.
watch(tab, (next) => {
  if (next !== 'export' && next !== camera.stillOwner) {
    camera.swapStill(camera.stillOwner, next);
  }
});

// Der Export soll genauso hoch sein wie die anderen Tabs: Deren Höhe merkt sich die App und setzt sie
// im Export als Mindesthöhe.
const panel = useTemplateRef<HTMLElement>('panel');
const knownHeight = ref(0);
const panelStyle = computed(() =>
  tab.value === 'export' && knownHeight.value > 0
    ? { minHeight: `${String(knownHeight.value)}px` }
    : undefined,
);
const stopTracking = ref<(() => void) | null>(null);
onMounted(() => {
  const element = panel.value;
  /* v8 ignore next 3 -- der Inhaltsbereich existiert, sobald die App eingehängt ist */
  if (element === null) {
    return;
  }
  stopTracking.value = trackHeight(element, (height) => {
    if (tab.value !== 'export') {
      knownHeight.value = height;
    }
  });
});

onBeforeUnmount(() => {
  stopTracking.value?.();
  camera.stop();
});
</script>

<template>
  <main class="w-full space-y-3 p-3 md:px-6 md:py-4">
    <!-- Reiter und Inhalt gehören zusammen: Der gewählte Reiter geht in den Rahmen um den Inhalt über. -->
    <div>
      <header class="flex flex-wrap items-end gap-x-3 gap-y-2">
        <h1 class="pb-1.5 text-xl font-semibold">{{ APP_NAME }}</h1>

        <div role="tablist" aria-label="Bereiche" class="ml-2 flex flex-wrap gap-1">
          <button
            v-for="entry in entries"
            :id="`tab-${entry.key}`"
            :key="entry.key"
            type="button"
            role="tab"
            class="relative flex items-center gap-2 rounded-t-lg border border-b-0 px-3 pb-1.5 pt-1 text-left text-sm leading-tight"
            :class="
              tab === entry.key
                ? 'z-10 -mb-px border-zinc-800 bg-white text-zinc-900'
                : 'border-zinc-400 bg-zinc-100 text-zinc-700 hover:bg-zinc-50'
            "
            :aria-label="entry.label"
            :aria-describedby="`tab-hint-${entry.key}`"
            :aria-selected="tab === entry.key"
            :aria-controls="`panel-${entry.key}`"
            @click="tab = entry.key"
          >
            <StatusGauge
              v-if="entry.status !== null"
              :level="entry.status.level"
              :fill="entry.status.fill"
            />
            <span>
              <span class="block">{{ entry.label }}</span>
              <small :id="`tab-hint-${entry.key}`" class="block text-[10px] text-zinc-500">{{
                entry.text
              }}</small>
            </span>
          </button>
        </div>

        <div class="ml-auto flex items-center gap-2 pb-1">
          <CameraToggle />
          <SettingsMenu />
        </div>
      </header>

      <div class="space-y-3 rounded-b-lg rounded-tr-lg border border-zinc-800 bg-white p-3">
        <ProjectStatus />

        <div
          :id="`panel-${tab}`"
          ref="panel"
          class="flex flex-col"
          role="tabpanel"
          :aria-labelledby="`tab-${tab}`"
          :style="panelStyle"
        >
          <GrayStep v-if="tab === 'gray'" />
          <ColorStep v-else-if="tab === 'color'" />
          <PreviewTab v-else-if="tab === 'preview'" />
          <ExportTab v-else @goto="tab = $event" />
        </div>
      </div>
    </div>

    <footer class="text-xs text-slate-500">
      {{ APP_ID }} · LUT-Generator für die Spyder Checkr Photo.
    </footer>
  </main>
</template>
