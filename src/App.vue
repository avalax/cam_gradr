<script setup lang="ts">
import CameraPanel from './ui/CameraPanel.vue';
import { APP_ID, APP_NAME } from './ui/app-info';
</script>

<template>
  <main class="mx-auto max-w-5xl space-y-4 p-6">
    <h1 class="text-2xl font-semibold">{{ APP_NAME }}</h1>
    <p class="text-slate-600">Webcam-LUT-Generator für die Spyder Checkr Photo.</p>
    <CameraPanel />
    <footer class="text-xs text-slate-500">{{ APP_ID }}</footer>
  </main>
</template>
