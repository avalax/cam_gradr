import { expect, test } from './support/fixtures';

// Acceptance tests of the language: the app follows the browser language, can be switched in the
// settings and remembers the choice. The default browser locale is de-DE, so the German
// scenarios assert the German interface.

test.describe('Language: English browser', () => {
  test.use({ locale: 'en-US' });

  test('The app appears in English, including the lang attribute of the page', async ({ app }) => {
    await app.open();

    await expect(app.page.getByRole('tab', { name: 'Gray cards', exact: true })).toBeVisible();
    await expect(app.page.getByRole('tab', { name: 'Color cards', exact: true })).toBeVisible();
    await expect(app.page.getByRole('tab', { name: 'Preview', exact: true })).toBeVisible();
    await expect(app.cameraSwitch).toHaveText('Start camera');
    await expect(app.page.getByText('The camera is off')).toBeVisible();
    await expect(app.page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('The English flow detects the gray cards and rates the light in English', async ({
    app,
  }) => {
    await app.open();
    await app.cameraSwitch.click();
    await expect(app.cameraSwitch).toHaveAttribute('aria-checked', 'true');
    await expect(app.cameraSwitch).toHaveText('Stop camera');

    // The automatic mode captures the still by itself and turns the camera off.
    await expect(app.cameraSwitch).toHaveAttribute('aria-checked', 'false', { timeout: 20_000 });
    await app.scale.hover();
    await expect(app.details).toContainText('within the normal range');
    await expect(app.page.getByRole('tab', { name: 'Gray cards', exact: true })).toContainText(
      'Lighting is fine',
    );
  });
});

test.describe('Language: German browser', () => {
  test('The app appears in German, including the lang attribute of the page', async ({ app }) => {
    await app.open();

    await expect(app.page.getByRole('tab', { name: 'Graukarten', exact: true })).toBeVisible();
    await expect(app.page.locator('html')).toHaveAttribute('lang', 'de');
  });

  test('The language can be switched in the settings and persists after reloading', async ({
    app,
  }) => {
    await app.open();
    await app.page.getByTestId('settings-button').click();
    await app.page.getByTestId('section-language').click();
    await expect(app.page.getByRole('radio', { name: 'Automatisch (Browser)' })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    await app.page.getByRole('radio', { name: 'English' }).click();
    await expect(app.page.getByRole('tab', { name: 'Gray cards', exact: true })).toBeVisible();
    await expect(app.page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(app.page.getByTestId('section-language')).toContainText('English');

    // The choice also applies after reloading, although the browser is German.
    await app.page.reload();
    await expect(app.page.getByRole('tab', { name: 'Gray cards', exact: true })).toBeVisible();

    // With "Automatic (browser)" the app follows the browser again.
    await app.page.getByTestId('settings-button').click();
    await app.page.getByTestId('section-language').click();
    await app.page.getByRole('radio', { name: 'Automatic (browser)' }).click();
    await expect(app.page.getByRole('tab', { name: 'Graukarten', exact: true })).toBeVisible();
    await expect(app.page.locator('html')).toHaveAttribute('lang', 'de');
  });
});
