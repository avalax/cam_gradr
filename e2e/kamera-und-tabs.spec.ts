import { expect, test } from './support/fixtures';

// Akzeptanztests für die Bedienung: Tabs und der Tab "Kamera" mit den Modi "Kamera an" und "Kamera aus".

test.describe('Tabs', () => {
  test('Alle Tabs sind sofort frei anwählbar', async ({ app }) => {
    await app.open();

    await expect(app.page.getByRole('tab')).toHaveCount(3);
    await app.openTab('Farbkarten');
    await expect(app.page.getByText('Dieser Tab berechnet die Farbkorrektur')).toBeVisible();
    await app.openTab('Graukarten');
    await expect(app.page.getByText('Dieser Tab stellt die Raumhelligkeit ein')).toBeVisible();
    await app.openTab('Kamera');
    await expect(app.button('Kamera an')).toBeVisible();
  });

  test('Ohne Kamera weisen die Kartentabs auf den Kamera-Tab hin', async ({ app }) => {
    await app.open();
    await app.openTab('Graukarten');

    await expect(app.page.getByText('Die Kamera ist aus')).toBeVisible();
    await expect(app.button('Standbild aufnehmen')).toBeDisabled();
  });
});

test.describe('Kamera-Tab', () => {
  test('Kamera an zeigt Optionen und Livebild, Kamera aus tauscht sie aus', async ({ app }) => {
    await app.open();
    await expect(app.button('Kamera aus')).toHaveAttribute('aria-pressed', 'true');
    await expect(app.page.getByTestId('camera-off-hint')).toBeVisible();
    await expect(app.page.locator('video')).toHaveCount(0);

    await app.startCamera();
    await expect(app.button('Kamera an')).toHaveAttribute('aria-pressed', 'true');
    await expect(app.page.getByRole('note')).toContainText('Auto-Belichtung');
    await expect(app.page.getByLabel('Auflösung')).toBeVisible();
    await expect(app.page.locator('video')).toBeVisible();
    await expect(app.page.getByTestId('camera-off-hint')).toHaveCount(0);

    await app.button('Kamera aus').click();
    await expect(app.page.getByLabel('Auflösung')).toHaveCount(0);
    await expect(app.page.locator('video')).toHaveCount(0);
    await expect(app.page.getByTestId('camera-off-hint')).toBeVisible();
  });

  test('Ein Standbild aus dem Kamera-Tab lässt sich im Tab Graukarten weiterverwenden', async ({
    app,
  }) => {
    await app.open();
    await app.startCamera();
    await app.button('Standbild aufnehmen').click();
    await expect(app.page.getByText('Ein Standbild liegt bereit')).toBeVisible();

    await app.button('Kamera aus').click();
    await expect(app.page.getByTestId('still-info')).toContainText('1280 × 720');
    await expect(app.page.locator('canvas')).toBeVisible();

    await app.openTab('Graukarten');
    await expect(app.button('Zurück zum Livebild')).toBeVisible();
    await app.placeAllCorners();
    await app.expectVerdict('Die Raumhelligkeit passt');
  });

  test('Ein Standbild lässt sich im Kamera-Tab verwerfen', async ({ app }) => {
    await app.open();
    await app.startCamera();
    await app.button('Standbild aufnehmen').click();
    await expect(app.page.getByText('Ein Standbild liegt bereit')).toBeVisible();
    await app.button('Kamera aus').click();
    await app.button('Standbild verwerfen').click();

    await expect(app.page.getByText('Noch kein Standbild aufgenommen')).toBeVisible();
    await expect(app.page.getByTestId('still-info')).toHaveCount(0);
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
