import { expect, test } from './support/fixtures';

// Acceptance test of the language: the app follows the browser language, can be switched in the
// settings and remembers the choice. Which browser language leads to which app language and that
// all texts exist in both languages is checked by the unit tests and the linter; here the browser
// language, the lang attribute and the reload count.

test.describe('Language: German browser', () => {
  test('The app starts in German, a choice in the settings persists after reloading', async ({
    app,
  }) => {
    await app.open();
    await expect(app.page.getByRole('tab', { name: 'Graukarten', exact: true })).toBeVisible();
    await expect(app.page.locator('html')).toHaveAttribute('lang', 'de');

    await app.page.getByTestId('settings-button').click();
    await app.page.getByTestId('section-language').click();
    await app.page.getByRole('radio', { name: 'English' }).click();
    await expect(app.page.getByRole('tab', { name: 'Gray cards', exact: true })).toBeVisible();
    await expect(app.page.locator('html')).toHaveAttribute('lang', 'en');

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
