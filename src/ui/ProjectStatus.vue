<script setup lang="ts">
import { storeToRefs } from 'pinia';

import { useProjectStore } from '../project/project-store';

const { error, notice } = storeToRefs(useProjectStore());
</script>

<template>
  <div v-if="error !== null || notice !== null" class="space-y-1">
    <p v-if="error !== null" class="text-sm text-red-700" role="alert" data-testid="project-error">
      {{ error }}
    </p>
    <p
      v-if="notice !== null"
      class="text-sm text-slate-700"
      role="status"
      data-testid="project-notice"
    >
      {{ notice }}
    </p>
  </div>
</template>
