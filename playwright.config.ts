import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const isCi = Boolean(process.env.CI);

// Akzeptanztests laufen gegen den Produktions-Build (vite preview) in Chrome und Firefox mit einer synthetischen Kamera.
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
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
    timeout: 300_000,
  },
});
