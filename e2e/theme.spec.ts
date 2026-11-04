import { expect, test } from './support/fixtures';

// Acceptance test of the appearance: the app follows the device, can be switched in the settings
// and remembers the choice. The dark appearance does not send as much light onto the cards.

test.describe('Appearance: dark device', () => {
  test.use({ colorScheme: 'dark' });

  test('The app follows the device, a light choice overrides it and persists after reloading', async ({
    app,
  }) => {
    await app.open();
    await expect(app.page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const background = await app.page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );
    expect(background).toBe('rgb(28, 28, 31)');

    await app.page.getByTestId('settings-button').click();
    await app.page.getByTestId('section-theme').click();
    await app.page.getByTestId('theme-options').getByRole('radio', { name: 'Hell' }).click();
    await expect(app.page.locator('html')).toHaveAttribute('data-theme', 'light');

    await app.page.reload();
    await expect(app.page.locator('html')).toHaveAttribute('data-theme', 'light');
  });
});
