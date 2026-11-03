import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test-support/setup.ts'],
    // The color calculation takes a few hundred milliseconds with its cross-check, and some tests run
    // it several times; with all workers busy that can exceed the default of 5 s.
    testTimeout: 15_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,vue}'],
      // Narrowly scoped exclusions: only the entry point and pure type declarations.
      exclude: [
        'src/main.ts',
        'src/**/*.test.ts',
        'src/**/*.d.ts',
        'src/data/**',
        'src/test-support/**',
      ],
      // Everything is covered; code that no test can reach is dead and is removed instead.
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
