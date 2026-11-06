import { defineConfig, devices } from '@playwright/test';

import base from './playwright.config';

// Renders the picture at the top of the README from the production build (`npm run readme:image`).
// It is not part of the acceptance tests: English interface, light appearance, sharp on high
// resolution screens.
export default defineConfig({
  ...base,
  testDir: './e2e/readme',
  testIgnore: [],
  workers: 1,
  retries: 0,
  reporter: [['list']],
  projects: [
    {
      name: 'chrome',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 2,
        locale: 'en-US',
        colorScheme: 'light',
        launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
      },
    },
  ],
});
