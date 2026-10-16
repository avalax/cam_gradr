import { expect, test } from './support/fixtures';

// Akzeptanztests der User Story, Stand M2:
// "Als Anwender stelle ich mit den Graukarten die Raumhelligkeit ein, bis die Ampel grün ist."

test.describe('Schritt 1: Raum passt', () => {
  test.use({ lighting: 'ok' });

  test('Ampel wird grün, danach ist Schritt 2 erreichbar', async ({ app }) => {
    const { page } = app;
    await app.open();

    await expect(page.getByRole('note')).toContainText('Auto-Belichtung');
    await expect(app.button('Schritt 2: Farbkarten')).toBeDisabled();

    await app.startCamera();
    await app.captureStill();
    await expect(page.getByText('oben links der linke Graukarte (50 %)')).toBeVisible();

    await app.placeAllCorners();
    await expect(app.badge).toContainText('Die Raumhelligkeit passt');
    await expect(page.getByText('Lichter')).toBeVisible();

    await app.button('Weiter zu Schritt 2').click();
    await expect(page.getByText('Schritt 2 (Farbkarten')).toBeVisible();
    await expect(app.button('Schritt 2: Farbkarten')).toBeEnabled();
  });

  test('Livebild misst mit denselben Eckpunkten weiter', async ({ app }) => {
    await app.open();
    await app.startCamera();
    await app.captureStill();
    await app.placeAllCorners();
    await expect(app.badge).toContainText('passt');

    await app.button('Zurück zum Livebild').click();
    await expect(app.page.locator('video')).toBeVisible();
    await expect(app.button('Zurück zum Livebild')).toBeHidden();
    await expect(app.badge).toContainText('passt');
  });

  test('Eckpunkte lassen sich zurücksetzen', async ({ app }) => {
    await app.open();
    await app.startCamera();
    await app.captureStill();
    await app.placeAllCorners();

    await app.button('Eckpunkte zurücksetzen').click();
    await expect(app.page.locator('svg circle')).toHaveCount(0);
    await expect(app.page.getByText('Noch keine Messung')).toBeVisible();
    await expect(app.button('Weiter zu Schritt 2')).toBeDisabled();
  });

  test('Eckpunkte setzt man nur auf dem Standbild', async ({ app }) => {
    await app.open();
    await app.startCamera();

    const box = await app.overlay.boundingBox();
    expect(box).not.toBeNull();
    await app.page.mouse.click((box?.x ?? 0) + 50, (box?.y ?? 0) + 50);
    await expect(app.page.locator('svg circle')).toHaveCount(0);
    await expect(
      app.page.getByText('ruhig vor die Kamera halten und ein Standbild aufnehmen'),
    ).toBeVisible();
  });
});

test.describe('Schritt 1: Raum zu dunkel', () => {
  test.use({ lighting: 'dark' });

  test('Ampel verlangt mehr Licht, Weiter bleibt gesperrt', async ({ app }) => {
    await app.open();
    await app.startCamera();
    await app.captureStill();
    await app.placeAllCorners();

    await expect(app.badge).toContainText('zu dunkel');
    await expect(app.button('Weiter zu Schritt 2')).toBeDisabled();
  });
});

test.describe('Schritt 1: Raum zu hell', () => {
  test.use({ lighting: 'bright' });

  test('Ampel verlangt weniger Licht und meldet geclippte Lichter', async ({ app }) => {
    await app.open();
    await app.startCamera();
    await app.captureStill();
    await app.placeAllCorners();

    await expect(app.badge).toContainText('zu hell');
    await expect(app.page.getByText('geclippt')).toBeVisible();
    await expect(app.button('Weiter zu Schritt 2')).toBeDisabled();
  });
});
