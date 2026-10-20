import { expect, test as base } from '@playwright/test';

import { AppPage } from './app-page';
import { installSyntheticCamera } from './camera-stub';
import type { LightingName } from './synthetic-cards';

interface Fixtures {
  // Lighting of the synthetic camera; selectable per scenario or block with test.use().
  lighting: LightingName;
  app: AppPage;
}

export const test = base.extend<Fixtures>({
  lighting: ['ok', { option: true }],

  app: async ({ page, lighting }, use) => {
    // Every unhandled error of the page fails the test (no silent white screen).
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });
    await installSyntheticCamera(page, lighting);
    await use(new AppPage(page));
    expect(errors, 'unhandled errors in the page').toEqual([]);
  },
});

export { expect } from '@playwright/test';
