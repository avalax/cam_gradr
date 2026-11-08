<script setup lang="ts">
// Messages over the bottom edge of the image: a camera error (the camera could not start, a capture
// failed) and the hint while the app searches for the cards. They lie on the image instead of under
// it, so that the image keeps its place in every state; they let the pointer through to the corner
// points.
defineProps<{ error: string | null; hint: string | null }>();
</script>

<template>
  <div
    v-if="error !== null || hint !== null"
    class="pointer-events-none absolute inset-x-3 bottom-3 z-10 flex flex-col items-center gap-1.5 text-center"
  >
    <p
      v-if="error !== null"
      class="max-w-md rounded-md bg-red-700 px-3 py-2 text-sm text-white shadow-lg"
      role="alert"
      data-testid="camera-error"
    >
      {{ error }}
    </p>
    <p
      v-if="hint !== null"
      class="max-w-xl rounded-md bg-zinc-950/75 px-3 py-1.5 text-xs leading-snug text-white"
      data-testid="auto-hint"
    >
      {{ hint }}
    </p>
  </div>
</template>
