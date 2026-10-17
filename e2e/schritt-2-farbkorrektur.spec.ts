import type { Page } from '@playwright/test';

import { labToSrgb } from '../src/color/lab';
import {
  dummyLab,
  dummyReferenceCsv,
  dummyReferenceJson,
} from '../src/test-support/dummy-reference';

import { expect, test } from './support/fixtures';

// Akzeptanztests der User Story, Stand M3:
// "Als Anwender nutze ich Referenzwerte (mitgeliefert oder eigene), nehme die Farbkarten auf und sehe,
// wie viel besser die Farben der Kamera mit der berechneten Korrektur werden."

test.describe('Farbkarten: Referenzwerte', () => {
  test('Der mitgelieferte Satz ist von Anfang an aktiv', async ({ app }) => {
    await app.completeStepOne();
    await expect(app.page.getByTestId('reference-active')).toContainText('(48 Felder)');

    // Ohne Aufnahme der Farbkarten gibt es noch kein Ergebnis, mit Eckpunkten rechnet die App selbst.
    await expect(app.page.getByTestId('report')).toBeHidden();
    await app.captureColorCards();
    await expect(app.page.getByTestId('report')).toBeVisible();
  });

  test('Das Zahnrad-Menü nennt die Quelle und bietet keinen Löschknopf für den mitgelieferten Satz', async ({
    app,
  }) => {
    await app.completeStepOne();
    await expect(app.page.getByTestId('settings-panel')).toBeHidden();
    await app.openSettings();

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

  test('Das Menü schließt mit Escape', async ({ app }) => {
    await app.open();
    await app.openSettings();
    await app.closeSettings();
    await expect(app.page.getByTestId('settings-button')).toHaveAttribute('aria-expanded', 'false');
  });

  test('Referenzwerte lassen sich als JSON importieren', async ({ app }) => {
    await app.completeStepOne();
    await app.importReference('referenz.json', dummyReferenceJson('Testdaten'));

    await expect(app.page.getByTestId('reference-active')).toContainText('Testdaten (48 Felder)');
  });

  test('Referenzwerte lassen sich als CSV importieren', async ({ app }) => {
    await app.completeStepOne();
    await app.importReference('messung.csv', dummyReferenceCsv());

    await expect(app.page.getByTestId('reference-active')).toContainText('messung (48 Felder)');
  });

  test('Eine fehlerhafte Datei wird abgelehnt', async ({ app }) => {
    await app.completeStepOne();
    await app.importReference('kaputt.json', '{"format":"anderes-format"}');

    await expect(app.page.getByRole('alert')).toContainText('Unbekanntes Format');
    await expect(app.page.getByTestId('reference-active')).toContainText('(48 Felder)');
    await expect(app.page.getByTestId('reference-active')).not.toContainText('kaputt');
  });

  test('Importierte Referenzwerte bleiben nach dem Neuladen auswählbar', async ({ app }) => {
    await app.completeStepOne();
    await app.importReference('referenz.json', dummyReferenceJson('Merkliste'));
    await expect(app.page.getByTestId('reference-active')).toContainText('Merkliste');
    // Erst nach der Rückmeldung ist der Satz sicher gespeichert und überlebt das Neuladen.
    await expect(app.page.getByTestId('reference-saved')).toBeVisible();

    await app.page.reload();
    await app.openSettings();
    const option = app.page
      .getByTestId('reference-select')
      .locator('option', { hasText: 'Merkliste' });
    await expect(option).toHaveCount(1);
    await app.page.getByTestId('reference-select').selectOption('Merkliste');
    await app.closeSettings();
    await app.openTab('Farbkarten');
    await expect(app.page.getByTestId('reference-active')).toContainText('Merkliste');
  });

  test('Ein importierter Satz lässt sich wieder löschen', async ({ app }) => {
    await app.completeStepOne();
    await app.importReference('referenz.json', dummyReferenceJson('Weg damit'));
    await app.button('Satz löschen').click();

    // Erst nach der Rückmeldung ist der Satz auch aus dem lokalen Speicher entfernt.
    await expect(app.page.getByTestId('reference-removed')).toBeVisible();
    await expect(app.page.getByTestId('reference-active')).not.toContainText('Weg damit');
    await app.page.reload();
    await app.openSettings();
    const option = app.page
      .getByTestId('reference-select')
      .locator('option', { hasText: 'Weg damit' });
    await expect(option).toHaveCount(0);
  });

  test('Der aktive Satz lässt sich als Datei herunterladen und wieder importieren', async ({
    app,
  }) => {
    await app.completeStepOne();
    await app.importReference('referenz.json', dummyReferenceJson('Zum Mitnehmen'));
    const { fileName, text } = await app.download(app.page.getByTestId('reference-download'));

    expect(fileName).toBe('Zum Mitnehmen.json');
    await app.button('Satz löschen').click();
    await expect(app.page.getByTestId('reference-removed')).toBeVisible();
    await app.importReference(fileName, text);
    await expect(app.page.getByTestId('reference-active')).toContainText(
      'Zum Mitnehmen (48 Felder)',
    );
  });
});

test.describe('Farbkarten: Farbkorrektur', () => {
  test('Die Berechnung verbessert die Farben deutlich', async ({ app }) => {
    await app.completeStepOne();
    await app.importReference('referenz.json', dummyReferenceJson());
    await app.closeSettings();
    await app.captureColorCards();

    const report = app.page.getByTestId('report');
    await expect(report).toBeVisible();
    const before = Number(await app.page.getByTestId('mean-before').innerText());
    const after = Number(await app.page.getByTestId('mean-after').innerText());
    expect(before).toBeGreaterThan(4);
    expect(after).toBeLessThan(1.5);
    expect(after).toBeLessThan(before / 3);
    await expect(report.locator('[data-testid^="tile-"]')).toHaveCount(48);
  });

  test('Eckpunkte der Farbkarten lassen sich in beliebiger Reihenfolge setzen', async ({ app }) => {
    await app.completeStepOne();
    await app.importReference('referenz.json', dummyReferenceJson());
    await app.closeSettings();
    await app.showCards('colors');
    await app.captureStill();
    await app.placeAllCorners([0, 3, 2, 1]);

    await expect(app.page.getByTestId('report')).toBeVisible();
    const after = Number(await app.page.getByTestId('mean-after').innerText());
    expect(after).toBeLessThan(1.5);
  });
});

// Gemalte Farbe von Feld 1F in einer der beiden Farbleisten (0..255).
async function swatch(page: Page, strip: 'camera' | 'corrected'): Promise<number[]> {
  const color = await page
    .locator(`[data-testid="color-strip-${strip}"] [data-patch="1F"]`)
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  return (color.match(/\d+/g) ?? []).map(Number);
}

test.describe('Farbkarten: Farbleisten', () => {
  test('Links stehen die Farben der Kamera, rechts die korrigierten, vorher Standardfarben', async ({
    app,
  }) => {
    await app.completeStepOne();
    await app.importReference('referenz.json', dummyReferenceJson());
    await app.closeSettings();
    await expect(app.page.getByTestId('color-strip-camera')).toHaveAttribute(
      'data-measured',
      'false',
    );

    await app.captureColorCards();

    await expect(app.page.getByTestId('color-strip-camera')).toHaveAttribute(
      'data-measured',
      'true',
    );
    await expect(app.page.getByTestId('color-strip-corrected')).toHaveAttribute(
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
