import type { Page } from '@playwright/test';

import { labToSrgb } from '../src/color/lab';
import { dummyLab, dummyReferenceJson } from '../src/test-support/dummy-reference';

import { expect, test } from './support/fixtures';

// Acceptance tests of the user story, as of M3:
// "As a user I use reference values (bundled or my own), capture the color cards and see how much
// better the colors of the camera become with the computed correction."
// Formats, faulty files, the bundled set and the gear menu are covered by the unit and component
// tests; here the real pipeline from the camera to the correction and the browser storage count.
// The browser locale is de-DE by default, so the assertions check the German interface.

// The interface shows numbers with a decimal comma, as is usual in Germany.
function parseGerman(text: string): number {
  return Number(text.replace(',', '.'));
}

// Painted color of patch 5H in one of the two layers of the wipe (0..255).
async function swatch(page: Page, layer: 'camera' | 'corrected'): Promise<number[]> {
  const color = await page
    .locator(`[data-testid="color-wipe-${layer}"] [data-patch="5H"]`)
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  return (color.match(/\d+/g) ?? []).map(Number);
}

test.describe('Color cards', () => {
  test('The calculation clearly improves the colors, the wipe shows them corrected', async ({
    app,
  }) => {
    await app.completeStepOne();
    await app.importReference(dummyReferenceJson());
    await app.closeSettings();
    await app.captureColorCards();

    await app.showReport();
    const before = parseGerman(await app.page.getByTestId('mean-before').innerText());
    const after = parseGerman(await app.page.getByTestId('mean-after').innerText());
    expect(before).toBeGreaterThan(4);
    expect(after).toBeLessThan(1.5);
    expect(after).toBeLessThan(before / 3);

    // The wipe paints the camera colors on the left and the corrected ones on the right.
    const expected = labToSrgb(dummyLab('5H')).map((value) => Math.round(value * 255));
    const corrected = await swatch(app.page, 'corrected');
    const camera = await swatch(app.page, 'camera');
    for (const [index, value] of expected.entries()) {
      expect(Math.abs(Number(corrected[index]) - value)).toBeLessThanOrEqual(8);
    }
    expect(camera).not.toEqual(corrected);
  });

  test('Imported reference values remain after reloading until they are deleted', async ({
    app,
  }) => {
    await app.open();
    await app.importReference(dummyReferenceJson('Saved list'));
    // Only after the confirmation is the set safely stored and survives the reload.
    await expect(app.page.getByTestId('reference-saved')).toBeVisible();

    await app.page.reload();
    await app.openSettings('reference');
    const select = app.page.getByTestId('reference-select');
    await select.selectOption('Saved list');
    await app.closeSettings();
    await app.openTab('Farbkarten');
    await expect(app.page.getByTestId('reference-active')).toContainText('Saved list (48 Felder)');

    await app.openSettings('reference');
    await app.button('Satz löschen').click();
    // Only after the confirmation is the set also removed from the browser storage.
    await expect(app.page.getByTestId('reference-removed')).toBeVisible();
    await app.page.reload();
    await app.openSettings('reference');
    await expect(select.locator('option')).not.toHaveCount(0);
    await expect(select.locator('option', { hasText: 'Saved list' })).toHaveCount(0);
  });
});
