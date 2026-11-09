import { dummyReferenceJson } from '../src/test-support/dummy-reference';

import { expect, test } from './support/fixtures';

// Acceptance test of the user story:
// "As a user I use reference values (bundled or my own), capture the color cards and see how much
// better the colors of the camera become with the computed correction."
// Formats, faulty files, the bundled set and the gear menu are covered by the unit and component
// tests, and the calculation from the captured cards runs in the preview journey; here the browser
// storage counts.
// The browser locale is de-DE by default, so the assertions check the German interface.

test.describe('Color cards', () => {
  test('Imported reference values remain after reloading until they are deleted', async ({
    app,
  }) => {
    await app.open();
    await app.importReference(dummyReferenceJson('Saved list'));
    // Only after the confirmation is the set safely stored and survives the reload.
    await expect(app.page.getByTestId('reference-saved')).toBeVisible();

    await app.page.reload();
    await app.openReferenceSettings();
    const select = app.page.getByTestId('reference-select');
    await select.selectOption('Saved list');
    await app.closeSettings();
    await app.openTab('Farbkarten');
    await expect(app.page.getByTestId('reference-active')).toContainText(
      '„Saved list“ mit 48 Feldern',
    );

    await app.openReferenceSettings();
    await app.button('Satz löschen').click();
    // Only after the confirmation is the set also removed from the browser storage.
    await expect(app.page.getByTestId('reference-removed')).toBeVisible();
    await app.page.reload();
    await app.openReferenceSettings();
    await expect(select.locator('option')).not.toHaveCount(0);
    await expect(select.locator('option', { hasText: 'Saved list' })).toHaveCount(0);
  });
});
