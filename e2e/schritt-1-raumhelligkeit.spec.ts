import { expect, test } from './support/fixtures';

// Akzeptanztests der User Story (Tab "Graukarten"):
// "Als Anwender stelle ich mit den Graukarten die Raumhelligkeit ein, bis die Ampel grün ist."

test.describe('Graukarten: Raum passt', () => {
  test.use({ lighting: 'ok' });

  test('Der Punkt steht im Normalbereich', async ({ app }) => {
    const { page } = app;
    await app.open();

    await expect(page.getByRole('tab', { name: 'Farbkarten' })).toBeEnabled();

    await app.startCamera();
    await app.openSettings();
    await expect(page.getByRole('note')).toContainText('Auto-Belichtung');
    await app.closeSettings();
    await app.openTab('Graukarten');
    await app.captureStill();

    await app.expectCorners();
    await app.expectVerdict('im Normalbereich');
    await expect(app.details).toContainText('Lichter');
  });

  test('Das Layout liegt richtig auf beiden Karten', async ({ app }) => {
    await app.open();
    await app.startGrayStage();
    await app.captureStill();
    await app.expectCorners();

    // Große Felder sind hochkant; links der Karte steht der Streifen bei der rechten Karte (18 %),
    // rechts neben dem großen Feld bei der linken Karte (50 %).
    const [g50, g18, s3, s4] = [
      await app.shapeBox('G50'),
      await app.shapeBox('G18'),
      await app.shapeBox('S3-0'),
      await app.shapeBox('S4-0'),
    ];
    expect(g50.height).toBeGreaterThan(g50.width);
    expect(g18.height).toBeGreaterThan(g18.width);
    expect(s3.x).toBeGreaterThan(g50.x);
    expect(s4.x).toBeLessThan(g18.x);
  });

  test('Details des Messfelds erscheinen nur beim Überfahren oder Fokussieren', async ({ app }) => {
    await app.open();
    await app.startGrayStage();
    await app.captureStill();
    await app.expectCorners();

    await expect(app.details).toBeHidden();
    await app.scale.hover();
    await expect(app.details).toBeVisible();
    await app.page.mouse.move(0, 0);
    await expect(app.details).toBeHidden();
    await app.scale.focus();
    await expect(app.details).toBeVisible();
  });

  test('Das Kamerabild nutzt den Platz neben der Steuerung', async ({ app }) => {
    await app.page.setViewportSize({ width: 1600, height: 1200 });
    await app.open();
    await app.startGrayStage();

    const box = await app.overlay.boundingBox();
    // Fensterbreite 1600 minus Ränder, Steuerspalte (21 rem) und Messfeld
    expect(box?.width).toBeGreaterThan(1000);
  });

  for (const [width, height] of [
    [1280, 720],
    [1366, 768],
    [1600, 700],
    [1920, 900],
  ] as const) {
    {
      test(`Bild und Knöpfe passen im Tab Graukarten auf einen Bildschirm (${String(width)}×${String(height)})`, async ({
        app,
      }) => {
        await app.page.setViewportSize({ width, height });
        await app.open();
        await app.startCamera();
        await app.openTab('Graukarten');

        const image = await app.overlay.boundingBox();
        expect(image?.y).toBeGreaterThan(0);
        expect((image?.y ?? 0) + (image?.height ?? 0)).toBeLessThanOrEqual(height);
        const overflow = await app.page.evaluate(
          () => document.documentElement.scrollHeight - window.innerHeight,
        );
        expect(overflow).toBeLessThanOrEqual(0);
      });
    }
  }

  test('Livebild misst mit denselben Eckpunkten weiter', async ({ app }) => {
    await app.open();
    await app.startGrayStage();
    await app.captureStill();
    await app.expectCorners();
    await app.expectVerdict('im Normalbereich');

    await app.button('Zurück zum Livebild').click();
    await app.startCamera();
    await expect(app.page.locator('video')).toBeVisible();
    await expect(app.button('Zurück zum Livebild')).toBeHidden();
    await app.expectVerdict('im Normalbereich');
  });

  test('Mit „Eckpunkte löschen“ beginnt die automatische Suche von vorn', async ({ app }) => {
    await app.open();
    await app.startGrayStage();
    await app.captureStill();
    await app.expectCorners();

    await app.button('Eckpunkte löschen').click();
    await expect(app.button('Zurück zum Livebild')).toBeHidden();
    await expect(app.page.getByTestId('auto-hint')).toBeVisible();
    await expect(app.page.getByTestId('measure-marker')).toHaveCount(0);

    await app.captureStill();
    await app.expectCorners();
    await app.expectVerdict('im Normalbereich');
  });
});

test.describe('Graukarten: Raum zu dunkel', () => {
  test.use({ lighting: 'dark' });

  test('Ampel verlangt mehr Licht', async ({ app }) => {
    await app.open();
    await app.startGrayStage();
    await app.captureStill();
    await app.expectCorners();

    await app.expectVerdict('Helligkeit erhöhen');
  });
});

test.describe('Graukarten: Raum zu hell', () => {
  test.use({ lighting: 'bright' });

  test('Ampel verlangt weniger Licht und meldet überbelichtete Lichter', async ({ app }) => {
    await app.open();
    await app.startGrayStage();
    await app.captureStill();
    await app.expectCorners();

    await app.expectVerdict('Helligkeit verringern');
    await expect(app.details).toContainText('überbelichtet');
    await expect(app.page.getByTestId('measure-issue')).toContainText('Helligkeit zu hoch');
  });
});

test.describe('Graukarten: automatische Aufnahme', () => {
  test.use({ lighting: 'ok' });

  test('Die App nimmt das Standbild selbst auf, sobald die Karten im Bild sind', async ({
    app,
  }) => {
    await app.open();
    await app.startCamera();
    await app.openTab('Graukarten');
    await expect(app.page.getByTestId('auto-hint')).toBeVisible();

    await expect(app.page.getByTestId('detect-message')).toContainText('Standbild aufgenommen');
    await expect(app.page.locator('svg circle')).toHaveCount(8);
    await expect(app.cameraSwitch).toHaveAttribute('aria-checked', 'false');
    await expect(app.button('Zurück zum Livebild')).toBeVisible();
    await app.expectVerdict('im Normalbereich');
  });
});

test.describe('Graukarten: Hilfsrahmen', () => {
  test('Das Livebild zeigt, wo die Karten hingehalten werden sollen', async ({ app }) => {
    await app.open();
    await app.startGrayStage();
    await expect(app.page.getByTestId('guide')).toHaveCount(2);

    await app.captureStill();
    await expect(app.page.getByTestId('guide')).toHaveCount(0);
  });
});

test.describe('Graukarten: Messfeld', () => {
  test.use({ lighting: 'ok' });

  test('Das Messfeld zeigt Helligkeit und Kontrast mit einem Punkt im Normalbereich', async ({
    app,
  }) => {
    await app.open();
    await app.startGrayStage();
    await app.captureStill();
    await expect(app.scale).toBeVisible();
    await app.expectCorners();

    await expect(app.page.getByTestId('measure-marker')).toBeVisible();
    await app.expectVerdict('im Normalbereich');
  });
});
