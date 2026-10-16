import { test as base } from '@playwright/test';

import { AppPage } from './app-page';
import { installSyntheticCamera } from './camera-stub';
import type { LightingName } from './synthetic-cards';

interface Fixtures {
  // Beleuchtung der synthetischen Kamera; pro Szenario oder Block mit test.use() wählbar.
  lighting: LightingName;
  app: AppPage;
}

export const test = base.extend<Fixtures>({
  lighting: ['ok', { option: true }],

  app: async ({ page, lighting }, use) => {
    await installSyntheticCamera(page, lighting);
    await use(new AppPage(page));
  },
});

export { expect } from '@playwright/test';
