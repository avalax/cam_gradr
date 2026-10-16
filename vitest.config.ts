import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,vue}'],
      // Eng gefasste Ausschlüsse: nur Einstiegspunkt und reine Typdeklarationen.
      exclude: ['src/main.ts', 'src/**/*.test.ts', 'src/**/*.d.ts', 'src/data/**'],
      thresholds: {
        statements: 99,
        branches: 99,
        functions: 99,
        lines: 99,
      },
    },
  },
});
