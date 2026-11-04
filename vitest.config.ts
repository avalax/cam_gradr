import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [vue()],
  test: {
    // Without a DOM by default: test files that need one start with `// @vitest-environment happy-dom`.
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test-support/setup.ts'],
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
