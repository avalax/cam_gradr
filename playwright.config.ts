import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const isCi = Boolean(process.env.CI);
// Tall enough that the camera image with its overlay is clickable without scrolling.
const tallViewport = { viewport: { width: 1280, height: 1100 } };

// Acceptance tests run against the production build (vite preview) in Chrome and Firefox with a
// synthetic camera.
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  // Two browsers in parallel strain small machines and CI runners; fewer workers keep the tests stable.
  workers: isCi ? 2 : 4,
  expect: { timeout: 10_000 },
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  timeout: 45_000,
  reporter: isCi ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://localhost:${String(PORT)}`,
    // The scenarios check the German texts; English scenarios set the language themselves.
    locale: 'de-DE',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chrome',
      use: {
        ...devices['Desktop Chrome'],
        ...tallViewport,
        channel: 'chrome',
        // Software rendering (SwiftShader) so WebGL2 also runs without a graphics card.
        launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        ...tallViewport,
        // Allow WebGL even without a supported graphics card (software rendering).
        launchOptions: { firefoxUserPrefs: { 'webgl.force-enabled': true } },
      },
    },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${String(PORT)} --strictPort`,
    url: `http://localhost:${String(PORT)}`,
    reuseExistingServer: !isCi,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
    timeout: 300_000,
  },
});
