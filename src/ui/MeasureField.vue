<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import type { ExposureResult } from '../chart/exposure';

import { detailRows, fieldHint, fieldPosition, fieldRanges, fieldTitle } from './measure-field';
import { usePopupDismiss } from './popup-dismiss';

const props = defineProps<{ exposure: ExposureResult | null }>();
const { t } = useI18n();
const { dismissed, onKey, reset } = usePopupDismiss();

// Five fine gray levels vertically (light = brightness too high, dark = too low), similar to the
// zone system of photography. In the dark appearance the same steps are much dimmer, so the field
// does not throw light onto the cards.
const BANDS = [
  { light: '#fafafa', dark: '#4f4f55' },
  { light: '#e9e9ec', dark: '#47474c' },
  { light: '#d2d2d7', dark: '#3f3f44' },
  { light: '#b7b7be', dark: '#37373b' },
  { light: '#9a9aa2', dark: '#2f2f33' },
] as const;
// To the left the area gets lighter and flatter, to the right darker and higher in contrast.
const CONTRAST_SHADE =
  'linear-gradient(to right, rgba(255,255,255,.28), rgba(255,255,255,0) 35%, rgba(0,0,0,0) 65%, rgba(0,0,0,.14))';

function boxStyle(box: ReturnType<typeof fieldRanges>['ok']): Record<string, string> {
  return {
    left: `${String(box.left)}%`,
    top: `${String(box.top)}%`,
    width: `${String(box.width)}%`,
    height: `${String(box.height)}%`,
  };
}
const ranges = computed(() => fieldRanges(props.exposure));
const okStyle = computed(() => boxStyle(ranges.value.ok));
const slightStyle = computed(() => boxStyle(ranges.value.slight));
const title = computed(() => fieldTitle(props.exposure));
const hint = computed(() => fieldHint(props.exposure));
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
  <!-- Measuring field as tall as the camera image: on top the most important hint, in a band as high
       as the band over the image; below it brightness vertically, contrast horizontally; details on
       hover or keyboard focus. -->
  <div class="flex flex-col rounded-lg border border-zinc-500" data-testid="measure-side">
    <p
      class="rounded-t-[7px] border-b-(length:--band-line) border-zinc-700 bg-zinc-200 px-1 py-1.5 text-center text-[11px] font-semibold leading-tight text-zinc-800"
      data-testid="measure-title"
    >
      {{ title }}
    </p>
    <!-- eslint-disable-next-line vuejs-accessibility/no-static-element-interactions -- the focusable trigger of the details closes them with Escape -->
    <div
      class="group relative min-h-0 w-full flex-1 rounded-b-[7px]"
      tabindex="0"
      role="img"
      :aria-label="t('measure.aria', { hint })"
      data-testid="measure-field"
      @keydown="onKey"
      @mouseleave="reset"
      @focusout="reset"
    >
      <div class="absolute inset-0 overflow-hidden rounded-[inherit]">
        <div class="flex h-full flex-col">
          <div
            v-for="band in BANDS"
            :key="band.light"
            class="flex-1 bg-(--band-light) dark:bg-(--band-dark)"
            :style="{ '--band-light': band.light, '--band-dark': band.dark }"
          ></div>
        </div>
        <div class="absolute inset-0 dark:opacity-40" :style="{ background: CONTRAST_SHADE }"></div>

        <!-- Two lighter courts around the target: the outer one for slight deviations (good), the
             inner, lighter one for the normal range (very good). They shrink when the field zooms
             out for a measurement far off. -->
        <div
          class="pointer-events-none absolute rounded-[3px] bg-white/22 dark:bg-white/7"
          :style="slightStyle"
          data-testid="measure-slight-box"
        ></div>
        <div
          class="pointer-events-none absolute rounded-[3px] bg-white/60 dark:bg-white/17"
          :style="okStyle"
          data-testid="measure-ok-box"
        ></div>
      </div>

      <div
        v-if="markerStyle !== null"
        class="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-zinc-900 bg-white shadow"
        :style="markerStyle"
        data-testid="measure-marker"
      ></div>

      <!-- Opens on hover and after keyboard focus, not after a click; Escape closes it. -->
      <div
        v-if="!dismissed"
        class="pointer-events-none absolute right-full top-0 z-10 mr-3 hidden w-80 rounded bg-zinc-950 p-3 text-sm text-white shadow-lg group-hover:block group-focus-visible:block"
        role="tooltip"
        data-testid="measure-details"
      >
        <p class="font-medium" data-testid="measure-hint">{{ hint }}</p>
        <!-- The percentages are brightness values in the camera image. -->
        <p v-if="rows.length > 0" class="mt-2 text-xs text-white/70">
          {{ t('measure.caption') }}
        </p>
        <dl v-if="rows.length > 0" class="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <template v-for="row in rows" :key="row.label">
            <dt class="text-white/70">{{ row.label }}</dt>
            <dd>{{ row.value }}</dd>
          </template>
        </dl>
      </div>
    </div>
  </div>
</template>
