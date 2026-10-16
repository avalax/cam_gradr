import { expect, test as base } from '@playwright/test';

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
    // Jeder unbehandelte Fehler der Seite lässt den Test scheitern (kein stilles Weißbild).
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });
    await installSyntheticCamera(page, lighting);
    await use(new AppPage(page));
    expect(errors, 'unbehandelte Fehler in der Seite').toEqual([]);
  },
});

export { expect } from '@playwright/test';
