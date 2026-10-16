import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const isCi = Boolean(process.env.CI);

// Akzeptanztests laufen gegen den Produktions-Build (vite preview) in Chrome und Firefox mit einer synthetischen Kamera.
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  // Zwei Browser parallel belasten kleine Rechner und CI-Runner; weniger Worker halten die Tests stabil.
  workers: isCi ? 2 : 4,
  expect: { timeout: 10_000 },
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  timeout: 45_000,
  reporter: isCi ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://localhost:${String(PORT)}`,
    // Hoch genug, damit das Kamerabild samt Overlay ohne Scrollen klickbar ist.
    viewport: { width: 1280, height: 1100 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${String(PORT)} --strictPort`,
    url: `http://localhost:${String(PORT)}`,
    reuseExistingServer: !isCi,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
    timeout: 300_000,
  },
});
