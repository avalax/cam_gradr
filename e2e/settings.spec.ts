import { expect, test } from './support/fixtures';

// Acceptance test of the remembered settings: language and appearance follow the browser and the
// device, a choice in the settings overrides them and persists after reloading. Which browser
// language leads to which app language, the automatic choices and that all texts exist in both
// languages are checked by the unit tests and the linter; here the browser language, the color
// scheme of the device and the reload count.

test.describe('Settings: German browser, dark device', () => {
  test.use({ colorScheme: 'dark' });

  test('Language and appearance follow browser and device, a choice persists after reloading', async ({
    app,
  }) => {
    await app.open();
    const html = app.page.locator('html');
    await expect(app.page.getByRole('tab', { name: 'Graukarten', exact: true })).toBeVisible();
    await expect(html).toHaveAttribute('lang', 'de');
    await expect(html).toHaveAttribute('data-theme', 'dark');
    // The dark appearance does not send as much light onto the cards.
    const background = await app.page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );
    expect(background).toBe('rgb(28, 28, 31)');

    await app.page.getByTestId('settings-button').click();
    await app.page.getByTestId('section-theme').click();
    await app.page.getByTestId('theme-options').getByRole('radio', { name: 'Hell' }).click();
    await expect(html).toHaveAttribute('data-theme', 'light');
    await app.page.getByTestId('section-language').click();
    await app.page.getByRole('radio', { name: 'English' }).click();
    await expect(app.page.getByRole('tab', { name: 'Gray cards', exact: true })).toBeVisible();
    await expect(html).toHaveAttribute('lang', 'en');

    // Both choices also apply after reloading, although browser and device say otherwise.
    await app.page.reload();
    await expect(app.page.getByRole('tab', { name: 'Gray cards', exact: true })).toBeVisible();
    await expect(html).toHaveAttribute('data-theme', 'light');
  });
});
