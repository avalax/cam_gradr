import { expect, test } from './support/fixtures';

// Akzeptanztests für die Bedienung: Tabs, der Kameraschalter neben den Tabs und die Kameraeinstellungen
// im Zahnrad-Menü.

test.describe('Tabs', () => {
  test('Alle Tabs sind sofort frei anwählbar, zuerst steht Graukarten offen', async ({ app }) => {
    await app.open();

    await expect(app.page.getByRole('tab')).toHaveCount(4);
    await expect(app.page.getByRole('tab', { name: 'Graukarten' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(app.page.getByText('Dieser Tab stellt die Raumhelligkeit ein')).toBeVisible();
    await app.openTab('Farbkarten');
    await expect(app.page.getByText('Dieser Tab berechnet die Farbkorrektur')).toBeVisible();
    await app.openTab('Vorschau');
    await expect(app.page.getByTestId('preview-no-model')).toBeVisible();
    await app.openTab('Export');
    await expect(app.page.getByTestId('export-no-model')).toBeVisible();
  });

  test('Ohne Kamera weisen die Kartentabs auf den Kameraschalter hin', async ({ app }) => {
    await app.open();

    await expect(app.page.getByText('Die Kamera ist aus')).toBeVisible();
    await expect(app.button('Standbild aufnehmen')).toBeDisabled();
  });
});

test.describe('Kameraschalter', () => {
  test('Der Schalter startet und stoppt die Kamera, ohne den Tab zu wechseln', async ({ app }) => {
    await app.open();
    await expect(app.cameraSwitch).toHaveAttribute('aria-checked', 'false');
    await expect(app.cameraSwitch).toHaveText('Kamera starten');
    await expect(app.button('Standbild aufnehmen')).toBeDisabled();

    await app.openTab('Vorschau');
    await app.startCamera();
    await expect(app.cameraSwitch).toHaveText('Kamera stoppen');
    await expect(app.page.getByRole('tab', { name: 'Vorschau' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await app.openTab('Graukarten');
    await expect(app.page.locator('video')).toBeVisible();
    await expect(app.button('Standbild aufnehmen')).toBeEnabled();

    await app.stopCamera();
    await expect(app.cameraSwitch).toHaveText('Kamera starten');
    await expect(app.page.getByText('Die Kamera ist aus')).toBeVisible();
  });

  test('Die Kamera läuft beim Wechsel der Tabs weiter', async ({ app }) => {
    await app.open();
    await app.startCamera();
    await app.openTab('Farbkarten');
    await app.openTab('Export');

    await expect(app.cameraSwitch).toHaveAttribute('data-status', 'live');
  });

  test('Kameraauswahl, Auflösung und Hinweis zur Automatik liegen im Zahnrad-Menü', async ({
    app,
  }) => {
    await app.open();
    await expect(app.page.getByLabel('Auflösung')).toHaveCount(0);

    await app.openSettings();
    await expect(app.page.getByRole('note')).toContainText('Auto-Belichtung');
    await expect(app.page.getByLabel('Auflösung')).toBeVisible();
    await app.closeSettings();

    await app.startCamera();
    await app.openSettings();
    await expect(app.page.getByText('Aktive Auflösung')).toBeVisible();
  });

  test('Ein Standbild bleibt nach dem Ausschalten der Kamera sichtbar', async ({ app }) => {
    await app.open();
    await app.startGrayStage();
    await app.captureStill();
    await app.stopCamera();

    await expect(app.page.locator('canvas')).toBeVisible();
    await expect(app.button('Zurück zum Livebild')).toBeVisible();
  });

  test('Zwischen Grau- und Farbkarten wird das Standbild verworfen', async ({ app }) => {
    await app.open();
    await app.startGrayStage();
    await app.captureStill();

    await app.openTab('Farbkarten');
    await expect(app.button('Zurück zum Livebild')).toHaveCount(0);
    await expect(app.button('Standbild aufnehmen')).toBeVisible();
  });
});
