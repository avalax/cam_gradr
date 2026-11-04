import { expect, test as base } from '@playwright/test';

import { AppPage } from './app-page';
import { installSyntheticCamera } from './camera-stub';

interface Fixtures {
  app: AppPage;
}

export const test = base.extend<Fixtures>({
  app: async ({ page }, use) => {
    // Every unhandled error of the page fails the test (no silent white screen).
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });
    await installSyntheticCamera(page);
    // Chrome has the system file dialogs (File System Access API), which a test cannot operate; without
    // them the app downloads and uses the file input, as in Firefox. The dialogs themselves are
    // covered by the unit tests of the project file.
    await page.addInitScript(() => {
      for (const name of ['showOpenFilePicker', 'showSaveFilePicker']) {
        Object.defineProperty(globalThis, name, {
          configurable: true,
          writable: true,
          value: undefined,
        });
      }
    });
    await use(new AppPage(page));
    expect(errors, 'unhandled errors in the page').toEqual([]);
  },
});

export { expect } from '@playwright/test';
