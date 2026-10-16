import { test as base } from '@playwright/test';

import { AppPage } from './app-page';
import { videoPath } from './synthetic-cards';
import type { LightingName } from './synthetic-cards';

interface Fixtures {
  // Beleuchtung der synthetischen Kamera; pro Szenario oder Block mit test.use() wählbar.
  lighting: LightingName;
  app: AppPage;
}

const FAKE_CAMERA = ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'];

// Startet pro Test einen eigenen Browser, weil Chrome das Kameravideo nur beim Start übernimmt.
export const test = base.extend<Fixtures>({
  lighting: ['ok', { option: true }],

  app: async ({ playwright, lighting, baseURL }, use, testInfo) => {
    const browser = await playwright.chromium.launch({
      args: [...FAKE_CAMERA, `--use-file-for-fake-video-capture=${videoPath(lighting)}`],
    });
    const context = await browser.newContext({
      ...(baseURL !== undefined && { baseURL }),
      viewport: { width: 1280, height: 1100 },
    });
    const page = await context.newPage();
    await use(new AppPage(page));
    if (testInfo.status !== testInfo.expectedStatus) {
      await testInfo.attach('screenshot', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });
    }
    await context.close();
    await browser.close();
  },
});

export { expect } from '@playwright/test';
