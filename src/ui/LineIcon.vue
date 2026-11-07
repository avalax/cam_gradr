<template>
  <!-- The frame of the line icons (camera, trash, gear): 24 × 24, round strokes in the text color;
       the paths come as slot content and the size as a class. Only paths, no <circle>: the tests and
       the README picture count the corner points of the cards as circles. -->
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <slot />
  </svg>
</template>
