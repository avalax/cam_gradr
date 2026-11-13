<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { useCameraStore } from './camera/camera-store';
import { useChartStore } from './chart/chart-store';
import { useLookStore } from './look/look-store';
import { usePreviewStore } from './lut/preview-store';
import { useReferenceStore } from './reference/reference-store';
import { recomputeOnChange } from './solve/recompute';
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
import { APP_VERSION } from './ui/app-version';
import { CAMERA_SWITCH_ID, focusById } from './ui/focus';
import { usePreviewArea } from './ui/preview-area';
import { previewSides } from './ui/preview-sides';
import { rovingTarget } from './ui/roving';
import { colorStatus, grayStatus } from './ui/tab-status';
import type { TabStatus } from './ui/tab-status';

type TabKey = 'gray' | 'color' | 'preview' | 'export';

// Each tab briefly states its result under its name. The two measuring tabs show a status that
// follows the result (light in the normal range, deviation after the correction), not mere editing;
// the preview names what lies left and right of its divider, the export has a fixed text. The texts
// are only translated when displayed so that a language change reaches them. Each tab is at least as
// wide as its longest text, so that the tabs do not move when a text changes.
const TABS: readonly {
  key: TabKey;
  width: string;
  label: () => string;
  summary: () => TabStatus | string;
}[] = [
  {
    key: 'gray',
    width: 'min-w-40',
    label: () => t('app.tabs.gray'),
    summary: () => grayStatus(exposure.value),
  },
  {
    key: 'color',
    width: 'min-w-40',
    label: () => t('app.tabs.color'),
    summary: () => colorStatus(result.value?.report ?? null, model.value !== null),
  },
  { key: 'preview', width: 'min-w-44', label: () => t('app.tabs.preview'), summary: previewHint },
  {
    key: 'export',
    width: 'min-w-24',
    label: () => t('app.tabs.export'),
    summary: () => t('app.hints.export'),
  },
];

const { t } = useI18n();

const preview = usePreviewStore();
const looks = useLookStore();
const previewArea = usePreviewArea();

// The hint names what lies left and right of the divider, with the names of the preview's labels.
function previewHint(): string {
  const sides = previewSides(
    looks.find(preview.look) !== null,
    preview.left,
    preview.right,
    previewArea.value.still,
  );
  return t('app.hints.preview', { left: sides.leftName, right: sides.rightName });
}

const tab = ref<TabKey>('gray');

// Opens a tab from a link in another tab: the link leaves with its tab, so the focus goes to the tab
// that opens.
function openTab(next: TabKey): void {
  tab.value = next;
  focusById(`tab-${next}`);
}

// The tabs as a WAI-ARIA tablist: one stop of the Tab key, the arrow keys move to the neighboring
// tab and open it, Home and End to the first and the last.
const tablist = useTemplateRef<HTMLElement>('tablist');

function onTabKey(event: KeyboardEvent, index: number): void {
  const next = rovingTarget(event.key, index, TABS.length, false);
  if (next !== null) {
    event.preventDefault();
    const target = tablist.value?.children[next] as HTMLButtonElement | undefined;
    target?.focus();
    target?.click();
  }
}

const camera = useCameraStore();
const cameraRuns = computed(() => camera.status === 'live' || camera.status === 'starting');
const { exposure } = storeToRefs(useChartStore());
const { result, model } = storeToRefs(useSolveStore());

const entries = computed(() =>
  TABS.map(({ key, width, label, summary }) => {
    const shown = summary();
    return typeof shown === 'string'
      ? { key, width, label: label(), status: null, text: shown }
      : { key, width, label: label(), status: shown, text: shown.text };
  }),
);

// The correction follows the color measurements and the reference set on every tab.
recomputeOnChange();

// The bundled reference set, the locally saved sets and the look LUTs are available from the start.
onMounted(() => {
  void useReferenceStore().load();
  void looks.load();
});

// Each tab with a camera image (gray cards, color cards, preview) has its own still image: on switching
// it is stored and shown again on return. The export shows no camera image.
watch(tab, (next) => {
  if (next !== 'export' && next !== camera.stillOwner) {
    camera.swapStill(camera.stillOwner, next);
  }
});

// The camera switch leaves the export when the camera stops. If it had the focus, the focus goes to
// the tab of the export before the switch is gone (this watcher runs before the page updates).
watch(cameraRuns, (runs) => {
  if (!runs && tab.value === 'export' && document.activeElement?.id === CAMERA_SWITCH_ID) {
    focusById('tab-export');
  }
});

onBeforeUnmount(() => {
  camera.stop();
});
</script>

<template>
  <main class="w-full space-y-3 p-3 md:px-6 md:py-4">
    <!-- Tab and content belong together: the selected tab merges into the frame around the content. -->
    <div>
      <header class="flex flex-wrap items-end gap-x-3 gap-y-2">
        <h1 class="pb-1.5 text-xl font-semibold">{{ APP_NAME }}</h1>

        <div
          ref="tablist"
          role="tablist"
          :aria-label="t('app.tablist')"
          class="ml-2 flex flex-wrap gap-1"
        >
          <button
            v-for="(entry, index) in entries"
            :id="`tab-${entry.key}`"
            :key="entry.key"
            type="button"
            role="tab"
            class="relative flex items-center gap-2 rounded-t-lg border border-b-0 px-3 pb-1.5 pt-1 text-left text-sm leading-tight"
            :class="[
              entry.width,
              tab === entry.key
                ? 'z-10 -mb-px border-zinc-800 bg-surface text-zinc-900'
                : 'border-zinc-400 bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-50',
            ]"
            :tabindex="tab === entry.key ? 0 : -1"
            :aria-label="entry.label"
            :aria-describedby="`tab-hint-${entry.key}`"
            :aria-selected="tab === entry.key"
            :aria-controls="`panel-${entry.key}`"
            @click="tab = entry.key"
            @keydown="onTabKey($event, index)"
          >
            <StatusGauge
              v-if="entry.status !== null"
              :level="entry.status.level"
              :fill="entry.status.fill"
            />
            <span>
              <span class="block">{{ entry.label }}</span>
              <small :id="`tab-hint-${entry.key}`" class="block text-[10px] text-zinc-500"
                >{{ entry.text
                }}<span v-if="entry.status?.rating" class="sr-only">
                  ({{ entry.status.rating }})</span
                ></small
              >
            </span>
          </button>
        </div>

        <div class="ml-auto flex items-center gap-2 pb-1">
          <!-- The export has no camera image: the switch only shows there while the camera runs. -->
          <CameraToggle v-if="tab !== 'export' || cameraRuns" />
          <SettingsMenu />
        </div>
      </header>

      <div class="rounded-b-lg rounded-tr-lg border border-zinc-800 bg-surface p-3">
        <div :id="`panel-${tab}`" role="tabpanel" :aria-labelledby="`tab-${tab}`">
          <GrayStep v-if="tab === 'gray'" />
          <ColorStep v-else-if="tab === 'color'" />
          <PreviewTab v-else-if="tab === 'preview'" />
          <ExportTab v-else @goto="openTab" />
        </div>

        <!-- The message floats at the bottom of the window; after the panel in the order of the Tab
             key, so that it does not stand between the tabs and what they show. -->
        <ProjectStatus />
      </div>
    </div>

    <footer class="text-xs text-zinc-500">
      {{ t('app.footer', { id: APP_ID, version: APP_VERSION }) }}
    </footer>
  </main>
</template>
