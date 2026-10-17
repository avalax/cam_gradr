import { dummyReferenceCsv, dummyReferenceJson } from '../src/test-support/dummy-reference';

import { expect, test } from './support/fixtures';

// Akzeptanztests der User Story, Stand M3:
// "Als Anwender importiere ich Referenzwerte, nehme die Farbkarten auf und sehe, wie viel besser
// die Farben der Kamera mit der berechneten Korrektur werden."

test.describe('Farbkarten: Referenzwerte', () => {
  test('Ohne Referenzwerte ist keine Berechnung möglich', async ({ app }) => {
    await app.completeStepOne();
    await expect(app.page.getByTestId('reference-hint')).toContainText('Noch keine Referenzwerte');

    await app.captureColorCards();
    await expect(app.button('Farbkorrektur berechnen')).toBeDisabled();
  });

  test('Referenzwerte lassen sich als JSON importieren', async ({ app }) => {
    await app.completeStepOne();
    await app.importReference('referenz.json', dummyReferenceJson('Testdaten'));

    await expect(app.page.getByTestId('reference-active')).toContainText('Testdaten (48 Felder)');
    await expect(app.page.getByTestId('reference-hint')).toBeHidden();
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
    await expect(app.page.getByTestId('reference-hint')).toBeVisible();
  });

  test('Importierte Referenzwerte bleiben nach dem Neuladen erhalten', async ({ app }) => {
    await app.completeStepOne();
    await app.importReference('referenz.json', dummyReferenceJson('Merkliste'));
    await expect(app.page.getByTestId('reference-active')).toContainText('Merkliste');
    // Erst nach der Rückmeldung ist der Satz sicher gespeichert und überlebt das Neuladen.
    await expect(app.page.getByTestId('reference-saved')).toBeVisible();

    await app.page.reload();
    await app.completeStepOne();
    await expect(app.page.getByTestId('reference-active')).toContainText('Merkliste');
  });

  test('Ein importierter Satz lässt sich wieder löschen', async ({ app }) => {
    await app.completeStepOne();
    await app.importReference('referenz.json', dummyReferenceJson('Weg damit'));
    await app.button('Satz löschen').click();

    await expect(app.page.getByTestId('reference-hint')).toBeVisible();
    // Erst nach der Rückmeldung ist der Satz auch aus dem lokalen Speicher entfernt.
    await expect(app.page.getByTestId('reference-removed')).toBeVisible();
    await app.page.reload();
    await app.completeStepOne();
    await expect(app.page.getByTestId('reference-hint')).toBeVisible();
  });

  test('Der mitgelieferte Satz lässt sich laden und nennt seine Quelle', async ({ app }) => {
    await app.completeStepOne();
    await expect(app.page.getByTestId('reference-source').getByRole('link')).toHaveAttribute(
      'href',
      /bartneck\.de/,
    );
    await app.page.getByTestId('reference-bundled').click();

    await expect(app.page.getByTestId('reference-active')).toContainText('(48 Felder)');
    await expect(app.page.getByTestId('reference-saved')).toBeVisible();
    // Der Satz bleibt danach lokal verfügbar.
    await app.page.reload();
    await app.completeStepOne();
    await expect(app.page.getByTestId('reference-active')).toContainText('(48 Felder)');
  });

  test('Der aktive Satz lässt sich als Datei herunterladen und wieder importieren', async ({
    app,
  }) => {
    await app.completeStepOne();
    await app.importReference('referenz.json', dummyReferenceJson('Zum Mitnehmen'));
    const { fileName, text } = await app.download(app.page.getByTestId('reference-download'));

    expect(fileName).toBe('Zum Mitnehmen.json');
    await app.button('Satz löschen').click();
    await expect(app.page.getByTestId('reference-hint')).toBeVisible();
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
    await app.captureColorCards();

    await app.button('Farbkorrektur berechnen').click();

    const report = app.page.getByTestId('report');
    await expect(report).toBeVisible();
    const before = Number(await app.page.getByTestId('mean-before').innerText());
    const after = Number(await app.page.getByTestId('mean-after').innerText());
    expect(before).toBeGreaterThan(4);
    expect(after).toBeLessThan(1.5);
    expect(after).toBeLessThan(before / 3);
    await expect(report.locator('li')).toHaveCount(48);
  });

  test('Eckpunkte der Farbkarten lassen sich in beliebiger Reihenfolge setzen', async ({ app }) => {
    await app.completeStepOne();
    await app.importReference('referenz.json', dummyReferenceJson());
    await app.showCards('colors');
    await app.captureStill();
    await app.placeAllCorners([0, 3, 2, 1]);

    await app.button('Farbkorrektur berechnen').click();
    const after = Number(await app.page.getByTestId('mean-after').innerText());
    expect(after).toBeLessThan(1.5);
  });
});
