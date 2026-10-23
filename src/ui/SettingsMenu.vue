<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { useCameraStore } from '../camera/camera-store';
import { useLanguageStore } from '../lang/language-store';
import { useThemeStore } from '../theme/theme-store';
import { useReferenceStore } from '../reference/reference-store';

import CameraControls from './CameraControls.vue';
import LanguageSettings from './LanguageSettings.vue';
import ReferencePanel from './ReferencePanel.vue';
import ThemeSettings from './ThemeSettings.vue';

type Section = 'camera' | 'reference' | 'language' | 'theme';

const { t } = useI18n();

const open = ref(false);
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
  const device = devices.value.find((entry) => entry.id === selectedDeviceId.value);
  const size = actual.value ?? resolution.value;
  return `${device?.label ?? t('camera.controls.defaultCamera')} · ${String(size.width)} × ${String(size.height)}`;
});
const referenceSummary = computed(() => selected.value?.name ?? t('settings.bundledSet'));

function onPointerDown(event: PointerEvent): void {
  // A click outside the menu closes it.
  if (open.value && (event.target as Element).closest('[data-settings-root]') === null) {
    open.value = false;
  }
}

function onKeyDown(event: KeyboardEvent): void {
  if (open.value && event.key === 'Escape') {
    open.value = false;
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
      type="button"
      class="rounded border px-2 py-1 text-lg leading-none"
      :aria-label="t('settings.title')"
      aria-haspopup="dialog"
      :aria-expanded="open"
      :title="t('settings.title')"
      data-testid="settings-button"
      @click="open = !open"
    >
      <span aria-hidden="true">⚙</span>
    </button>
    <div
      v-if="open"
      role="dialog"
      :aria-label="t('settings.title')"
      class="absolute right-0 top-full z-20 mt-2 max-h-[80vh] w-[min(26rem,calc(100vw-1.5rem))] overflow-auto rounded-lg border border-zinc-400 bg-white dark:bg-zinc-100 shadow-lg"
      data-testid="settings-panel"
    >
      <section aria-labelledby="camera-heading">
        <h2 id="camera-heading">
          <button
            type="button"
            class="flex w-full items-center gap-2 px-3 py-2.5 text-left"
            :aria-expanded="section === 'camera'"
            aria-controls="camera-body"
            data-testid="section-camera"
            @click="toggle('camera')"
          >
            <span class="text-sm font-semibold">{{ t('settings.sections.camera') }}</span>
            <small class="ml-auto truncate text-[11px] font-normal text-zinc-500">{{
              cameraSummary
            }}</small>
            <span aria-hidden="true" class="text-zinc-500">{{
              section === 'camera' ? '⌃' : '⌄'
            }}</span>
          </button>
        </h2>
        <div v-if="section === 'camera'" id="camera-body" class="px-3 pb-3">
          <CameraControls />
        </div>
      </section>
      <section class="border-t border-zinc-200" aria-labelledby="reference-heading">
        <h2 id="reference-heading">
          <button
            type="button"
            class="flex w-full items-center gap-2 px-3 py-2.5 text-left"
            :aria-expanded="section === 'reference'"
            aria-controls="reference-body"
            data-testid="section-reference"
            @click="toggle('reference')"
          >
            <span class="text-sm font-semibold">{{ t('settings.sections.reference') }}</span>
            <small class="ml-auto truncate text-[11px] font-normal text-zinc-500">{{
              referenceSummary
            }}</small>
            <span aria-hidden="true" class="text-zinc-500">{{
              section === 'reference' ? '⌃' : '⌄'
            }}</span>
          </button>
        </h2>
        <div v-if="section === 'reference'" id="reference-body" class="px-3 pb-3">
          <ReferencePanel />
        </div>
      </section>
      <section class="border-t border-zinc-200" aria-labelledby="language-heading">
        <h2 id="language-heading">
          <button
            type="button"
            class="flex w-full items-center gap-2 px-3 py-2.5 text-left"
            :aria-expanded="section === 'language'"
            aria-controls="language-body"
            data-testid="section-language"
            @click="toggle('language')"
          >
            <span class="text-sm font-semibold">{{ t('language.title') }}</span>
            <small class="ml-auto truncate text-[11px] font-normal text-zinc-500">{{
              languageSummary
            }}</small>
            <span aria-hidden="true" class="text-zinc-500">{{
              section === 'language' ? '⌃' : '⌄'
            }}</span>
          </button>
        </h2>
        <div v-if="section === 'language'" id="language-body" class="px-3 pb-3">
          <LanguageSettings />
        </div>
      </section>
      <section class="border-t border-zinc-200" aria-labelledby="theme-heading">
        <h2 id="theme-heading">
          <button
            type="button"
            class="flex w-full items-center gap-2 px-3 py-2.5 text-left"
            :aria-expanded="section === 'theme'"
            aria-controls="theme-body"
            data-testid="section-theme"
            @click="toggle('theme')"
          >
            <span class="text-sm font-semibold">{{ t('theme.title') }}</span>
            <small class="ml-auto truncate text-[11px] font-normal text-zinc-500">{{
              themeSummary
            }}</small>
            <span aria-hidden="true" class="text-zinc-500">{{
              section === 'theme' ? '⌃' : '⌄'
            }}</span>
          </button>
        </h2>
        <div v-if="section === 'theme'" id="theme-body" class="px-3 pb-3">
          <ThemeSettings />
        </div>
      </section>
    </div>
  </div>
</template>
