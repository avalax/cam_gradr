<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';
import { useI18n } from 'vue-i18n';

import { useCameraStore } from '../camera/camera-store';
import { useLanguageStore } from '../lang/language-store';
import { useThemeStore } from '../theme/theme-store';
import { useReferenceStore } from '../reference/reference-store';

import { cameraName } from './camera-name';
import CameraControls from './CameraControls.vue';
import { CHEVRON_PATH } from './icons';
import LanguageSettings from './LanguageSettings.vue';
import LineIcon from './LineIcon.vue';
import ReferencePanel from './ReferencePanel.vue';
import ThemeSettings from './ThemeSettings.vue';

// The sections of the menu in their order, each with its content; the heading is
// `settings.sections.<key>`.
const SECTIONS = [
  { key: 'camera', body: CameraControls },
  { key: 'reference', body: ReferencePanel },
  { key: 'language', body: LanguageSettings },
  { key: 'theme', body: ThemeSettings },
] as const;

type Section = (typeof SECTIONS)[number]['key'];

const { t } = useI18n();

const open = ref(false);
const gear = useTemplateRef<HTMLButtonElement>('gear');
// Expanded section; when collapsed, a short summary of the state is shown on the right.
const section = ref<Section | null>('camera');

function toggle(next: Section): void {
  section.value = section.value === next ? null : next;
}

const { devices, selectedDeviceId, resolution, actual } = storeToRefs(useCameraStore());
const { selected } = storeToRefs(useReferenceStore());
const { summary: languageSummary } = storeToRefs(useLanguageStore());
const { summary: themeSummary } = storeToRefs(useThemeStore());

const cameraSummary = computed(() => {
  const index = devices.value.findIndex((entry) => entry.id === selectedDeviceId.value);
  const device = devices.value[index];
  const name =
    device === undefined ? t('camera.controls.defaultCamera') : cameraName(device, index);
  const size = actual.value ?? resolution.value;
  return `${name} · ${String(size.width)} × ${String(size.height)}`;
});
const summaries = computed<Record<Section, string>>(() => ({
  camera: cameraSummary.value,
  reference: selected.value?.name ?? t('settings.bundledSet'),
  language: languageSummary.value,
  theme: themeSummary.value,
}));

function onPointerDown(event: PointerEvent): void {
  // A click outside the menu closes it.
  if (open.value && (event.target as Element).closest('[data-settings-root]') === null) {
    open.value = false;
  }
}

// Escape closes the menu and gives the focus back to the gear, so that the keyboard does not lose
// its place with the panel.
function onKeyDown(event: KeyboardEvent): void {
  if (open.value && event.key === 'Escape') {
    open.value = false;
    gear.value?.focus();
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('keydown', onKeyDown);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown);
  document.removeEventListener('keydown', onKeyDown);
});
</script>

<template>
  <div class="relative" data-settings-root>
    <button
      ref="gear"
      type="button"
      class="grid place-items-center rounded border border-zinc-800 px-[7px] py-[5px] hover:bg-zinc-200"
      :aria-label="t('settings.title')"
      aria-haspopup="dialog"
      :aria-expanded="open"
      :title="t('settings.title')"
      data-testid="settings-button"
      @click="open = !open"
    >
      <!-- A line icon like the camera and the trash: the gear character turns into a colored emoji
           in some browsers (Chrome on Windows). -->
      <LineIcon class="size-[18px]">
        <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
        <path
          d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
        />
      </LineIcon>
    </button>
    <div
      v-if="open"
      role="dialog"
      :aria-label="t('settings.title')"
      class="absolute right-0 top-full z-20 mt-2 max-h-[80vh] w-[min(26rem,calc(100vw-1.5rem))] divide-y divide-zinc-200 overflow-auto rounded-lg border border-zinc-400 bg-white dark:bg-zinc-100 shadow-lg"
      data-testid="settings-panel"
    >
      <section v-for="entry in SECTIONS" :key="entry.key" :aria-labelledby="`${entry.key}-heading`">
        <h2 :id="`${entry.key}-heading`">
          <button
            type="button"
            class="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-zinc-200"
            :aria-expanded="section === entry.key"
            :aria-controls="`${entry.key}-body`"
            :data-testid="`section-${entry.key}`"
            @click="toggle(entry.key)"
          >
            <span class="text-sm font-semibold">{{ t(`settings.sections.${entry.key}`) }}</span>
            <small class="ml-auto truncate text-[11px] font-normal text-zinc-500">{{
              summaries[entry.key]
            }}</small>
            <LineIcon
              class="size-4 shrink-0 text-zinc-500"
              :class="{ 'rotate-180': section === entry.key }"
            >
              <path :d="CHEVRON_PATH" />
            </LineIcon>
          </button>
        </h2>
        <div v-if="section === entry.key" :id="`${entry.key}-body`" class="px-3 pb-3">
          <component :is="entry.body" />
        </div>
      </section>
    </div>
  </div>
</template>
