import type { Page } from '@playwright/test';

import { labToSrgb } from '../src/color/lab';
import {
  dummyLab,
  dummyReferenceCsv,
  dummyReferenceJson,
} from '../src/test-support/dummy-reference';

import { expect, test } from './support/fixtures';

// Acceptance tests of the user story, as of M3:
// "As a user I use reference values (bundled or my own), capture the color cards and see how much
// better the colors of the camera become with the computed correction."
// The browser locale is de-DE by default, so the assertions check the German interface.

test.describe('Color cards: reference values', () => {
  test('The bundled set is active from the start', async ({ app }) => {
    await app.completeStepOne();
    await expect(app.page.getByTestId('reference-active')).toContainText('(48 Felder)');

    // Without a capture of the color cards there is no result yet; with corner points the app
    // calculates by itself.
    await expect(app.page.getByTestId('report')).toBeHidden();
    await app.captureColorCards();
    await app.showReport();
  });

  test('The gear menu names the source and offers no delete button for the bundled set', async ({
    app,
  }) => {
    await app.completeStepOne();
    await expect(app.page.getByTestId('settings-panel')).toBeHidden();
    await app.openSettings('reference');

    await expect(app.page.getByTestId('reference-source').getByRole('link')).toHaveAttribute(
      'href',
      /bartneck\.de/,
    );
    await expect(app.page.getByTestId('reference-source')).toContainText(
      'keine Datei von Datacolor',
    );
    await expect(app.button('Satz löschen')).toHaveCount(0);
    await expect(app.page.getByTestId('reference-download')).toBeVisible();
  });

  test('The menu closes with Escape', async ({ app }) => {
    await app.open();
    await app.openSettings();
    await app.closeSettings();
    await expect(app.page.getByTestId('settings-button')).toHaveAttribute('aria-expanded', 'false');
  });

  test('Reference values can be imported as JSON', async ({ app }) => {
    await app.completeStepOne();
    await app.importReference('reference.json', dummyReferenceJson('Test data'));

    await expect(app.page.getByTestId('reference-active')).toContainText('Test data (48 Felder)');
  });

  test('Reference values can be imported as CSV', async ({ app }) => {
    await app.completeStepOne();
    await app.importReference('measurement.csv', dummyReferenceCsv());

    await expect(app.page.getByTestId('reference-active')).toContainText('measurement (48 Felder)');
  });

  test('A faulty file is rejected', async ({ app }) => {
    await app.completeStepOne();
    await app.importReference('broken.json', '{"format":"other-format"}');

    await expect(app.page.getByRole('alert')).toContainText('Unbekanntes Format');
    await expect(app.page.getByTestId('reference-active')).toContainText('(48 Felder)');
    await expect(app.page.getByTestId('reference-active')).not.toContainText('broken');
  });

  test('Imported reference values remain selectable after reloading', async ({ app }) => {
    await app.completeStepOne();
    await app.importReference('reference.json', dummyReferenceJson('Saved list'));
    await expect(app.page.getByTestId('reference-active')).toContainText('Saved list');
    // Only after the confirmation is the set safely stored and survives the reload.
    await expect(app.page.getByTestId('reference-saved')).toBeVisible();

    await app.page.reload();
    await app.openSettings('reference');
    const option = app.page
      .getByTestId('reference-select')
      .locator('option', { hasText: 'Saved list' });
    await expect(option).toHaveCount(1);
    await app.page.getByTestId('reference-select').selectOption('Saved list');
    await app.closeSettings();
    await app.openTab('Farbkarten');
    await expect(app.page.getByTestId('reference-active')).toContainText('Saved list');
  });

  test('An imported set can be deleted again', async ({ app }) => {
    await app.completeStepOne();
    await app.importReference('reference.json', dummyReferenceJson('Delete me'));
    await app.button('Satz löschen').click();

    // Only after the confirmation is the set also removed from local storage.
    await expect(app.page.getByTestId('reference-removed')).toBeVisible();
    await expect(app.page.getByTestId('reference-active')).not.toContainText('Delete me');
    await app.page.reload();
    await app.openSettings('reference');
    const option = app.page
      .getByTestId('reference-select')
      .locator('option', { hasText: 'Delete me' });
    await expect(option).toHaveCount(0);
  });

  test('The active set can be downloaded as a file and imported again', async ({ app }) => {
    await app.completeStepOne();
    await app.importReference('reference.json', dummyReferenceJson('To take away'));
    const { fileName, text } = await app.download(app.page.getByTestId('reference-download'));

    expect(fileName).toBe('To take away.json');
    await app.button('Satz löschen').click();
    await expect(app.page.getByTestId('reference-removed')).toBeVisible();
    await app.importReference(fileName, text);
    await expect(app.page.getByTestId('reference-active')).toContainText(
      'To take away (48 Felder)',
    );
  });
});

test.describe('Color cards: color correction', () => {
  test('The calculation clearly improves the colors', async ({ app }) => {
    await app.completeStepOne();
    await app.importReference('reference.json', dummyReferenceJson());
    await app.closeSettings();
    await app.captureColorCards();

    await app.showReport();
    const report = app.page.getByTestId('report');
    const before = parseGerman(await app.page.getByTestId('mean-before').innerText());
    const after = parseGerman(await app.page.getByTestId('mean-after').innerText());
    expect(before).toBeGreaterThan(4);
    expect(after).toBeLessThan(1.5);
    expect(after).toBeLessThan(before / 3);
    await expect(report.locator('[data-testid^="tile-"]')).toHaveCount(48);
  });
});

// The interface shows numbers with a decimal comma, as is usual in Germany.
function parseGerman(text: string): number {
  return Number(text.replace(',', '.'));
}

// Painted color of patch 1F in one of the two layers of the wipe (0..255).
async function swatch(page: Page, layer: 'camera' | 'corrected'): Promise<number[]> {
  const color = await page
    .locator(`[data-testid="color-wipe-${layer}"] [data-patch="1F"]`)
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  return (color.match(/\d+/g) ?? []).map(Number);
}

test.describe('Color cards: wipe', () => {
  test('The camera colors are on the left, the corrected ones on the right, default colors before', async ({
    app,
  }) => {
    await app.completeStepOne();
    await app.importReference('reference.json', dummyReferenceJson());
    await app.closeSettings();
    await expect(app.page.getByTestId('color-wipe-camera')).toHaveAttribute(
      'data-measured',
      'false',
    );

    await app.captureColorCards();

    await expect(app.page.getByTestId('color-wipe-camera')).toHaveAttribute(
      'data-measured',
      'true',
    );
    await expect(app.page.getByTestId('color-wipe-corrected')).toHaveAttribute(
      'data-measured',
      'true',
    );
    const expected = labToSrgb(dummyLab('1F')).map((value) => Math.round(value * 255));
    const corrected = await swatch(app.page, 'corrected');
    const camera = await swatch(app.page, 'camera');
    for (const [index, value] of expected.entries()) {
      expect(Math.abs(Number(corrected[index]) - value)).toBeLessThanOrEqual(8);
    }
    expect(camera).not.toEqual(corrected);
  });
});
