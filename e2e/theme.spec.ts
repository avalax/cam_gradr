import { expect, test } from './support/fixtures';

// Acceptance tests of the appearance: the app follows the device, can be switched in the settings
// and remembers the choice. The dark appearance does not send as much light onto the cards.

test.describe('Appearance: dark device', () => {
  test.use({ colorScheme: 'dark' });

  test('The app follows the device and a light choice overrides it', async ({ app }) => {
    await app.open();
    await expect(app.page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await app.page.getByTestId('settings-button').click();
    await app.page.getByTestId('section-theme').click();
    await app.page.getByTestId('theme-options').getByRole('radio', { name: 'Hell' }).click();
    await expect(app.page.locator('html')).toHaveAttribute('data-theme', 'light');

    await app.page.reload();
    await expect(app.page.locator('html')).toHaveAttribute('data-theme', 'light');
  });
});

test.describe('Appearance: light device', () => {
  test.use({ colorScheme: 'light' });

  test('The dark choice darkens the page and is kept after reloading', async ({ app }) => {
    await app.open();
    await expect(app.page.locator('html')).toHaveAttribute('data-theme', 'light');

    await app.page.getByTestId('settings-button').click();
    await app.page.getByTestId('section-theme').click();
    await app.page.getByTestId('theme-options').getByRole('radio', { name: 'Dunkel' }).click();
    await expect(app.page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const background = await app.page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );
    expect(background).toBe('rgb(28, 28, 31)');

    await app.page.reload();
    await expect(app.page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });
});
