import { expect, test } from './support/fixtures';

// Akzeptanztests der User Story (Tab "Graukarten"):
// "Als Anwender stelle ich mit den Graukarten die Raumhelligkeit ein, bis die Ampel grün ist."

test.describe('Graukarten: Raum passt', () => {
  test.use({ lighting: 'ok' });

  test('Skala steht im Zielbereich, danach geht es mit den Farbkarten weiter', async ({ app }) => {
    const { page } = app;
    await app.open();

    await expect(page.getByRole('tab', { name: 'Farbkarten' })).toBeEnabled();

    await app.startCamera();
    await app.openSettings();
    await expect(page.getByRole('note')).toContainText('Auto-Belichtung');
    await app.closeSettings();
    await app.openTab('Graukarten');
    await app.captureStill();
    await expect(page.getByText('oben links der linke Graukarte (50 %)')).toBeVisible();

    await app.placeAllCorners();
    await app.expectVerdict('Die Raumhelligkeit passt');
    await expect(app.details).toContainText('Lichter');

    await app.button('Weiter zu den Farbkarten').click();
    await expect(page.getByText('Dieser Tab berechnet die Farbkorrektur')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Farbkarten' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  for (const [name, order] of [
    ['im Uhrzeigersinn', [0, 1, 2, 3]],
    ['gegen den Uhrzeigersinn', [0, 3, 2, 1]],
    ['beginnend unten rechts', [2, 3, 0, 1]],
  ] as const) {
    test(`Das Layout liegt richtig auf beiden Karten (Ecken ${name})`, async ({ app }) => {
      await app.open();
      await app.startGrayStage();
      await app.captureStill();
      await app.placeAllCorners(order);

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
  }

  test('Die Reihenfolge der Eckpunkte ist egal', async ({ app }) => {
    await app.open();
    await app.startGrayStage();
    await app.captureStill();
    // oben links, unten links, unten rechts, oben rechts (gegen den Uhrzeigersinn)
    await app.placeAllCorners([0, 3, 2, 1]);
    await app.expectVerdict('Die Raumhelligkeit passt');
  });

  test('Details der Helligkeitsskala erscheinen nur beim Überfahren oder Fokussieren', async ({
    app,
  }) => {
    await app.open();
    await app.startGrayStage();
    await app.captureStill();
    await app.placeAllCorners();

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
    // Fensterbreite 1600 minus Ränder, Steuerspalte (21 rem) und Skala
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

        const capture = await app.button('Standbild aufnehmen').boundingBox();
        expect(capture?.y).toBeGreaterThan(0);
        expect((capture?.y ?? 0) + (capture?.height ?? 0)).toBeLessThanOrEqual(height);
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
    await app.placeAllCorners();
    await app.expectVerdict('passt');

    await app.button('Zurück zum Livebild').click();
    await expect(app.page.locator('video')).toBeVisible();
    await expect(app.button('Zurück zum Livebild')).toBeHidden();
    await app.expectVerdict('passt');
  });

  test('Eckpunkte lassen sich zurücksetzen', async ({ app }) => {
    await app.open();
    await app.startGrayStage();
    await app.captureStill();
    await app.placeAllCorners();

    await app.button('Eckpunkte zurücksetzen').click();
    await expect(app.page.locator('svg circle')).toHaveCount(0);
    await app.expectVerdict('Noch keine Messung');
    await expect(app.button('Weiter zu den Farbkarten')).toBeDisabled();
  });

  test('Eckpunkte setzt man nur auf dem Standbild', async ({ app }) => {
    await app.open();
    await app.startGrayStage();

    const box = await app.overlay.boundingBox();
    expect(box).not.toBeNull();
    await app.page.mouse.click((box?.x ?? 0) + 50, (box?.y ?? 0) + 50);
    await expect(app.page.locator('svg circle')).toHaveCount(0);
    await expect(
      app.page.getByText('ruhig vor die Kamera halten und ein Standbild aufnehmen'),
    ).toBeVisible();
  });
});

test.describe('Graukarten: Raum zu dunkel', () => {
  test.use({ lighting: 'dark' });

  test('Ampel verlangt mehr Licht, Weiter bleibt gesperrt', async ({ app }) => {
    await app.open();
    await app.startGrayStage();
    await app.captureStill();
    await app.placeAllCorners();

    await app.expectVerdict('zu dunkel');
    await expect(app.button('Weiter zu den Farbkarten')).toBeDisabled();
  });
});

test.describe('Graukarten: Raum zu hell', () => {
  test.use({ lighting: 'bright' });

  test('Ampel verlangt weniger Licht und meldet geclippte Lichter', async ({ app }) => {
    await app.open();
    await app.startGrayStage();
    await app.captureStill();
    await app.placeAllCorners();

    await app.expectVerdict('zu hell');
    await expect(app.details).toContainText('geclippt');
    await expect(app.page.getByTestId('scale-clipped-top')).toBeVisible();
    await expect(app.button('Weiter zu den Farbkarten')).toBeDisabled();
  });
});

test.describe('Graukarten: automatische Aufnahme', () => {
  test.use({ lighting: 'ok' });

  test('Die App nimmt das Standbild selbst auf, sobald die Karten im Bild sind', async ({
    app,
  }) => {
    await app.open({ autoDetect: true });
    await app.startCamera();
    await app.openTab('Graukarten');
    await expect(app.page.getByTestId('auto-hint')).toBeVisible();

    await expect(app.page.getByTestId('detect-message')).toContainText('Standbild aufgenommen');
    await expect(app.page.locator('svg circle')).toHaveCount(8);
    await expect(app.cameraSwitch).toHaveAttribute('aria-checked', 'false');
    await expect(app.button('Zurück zum Livebild')).toBeVisible();
    await app.expectVerdict('Die Raumhelligkeit passt');
  });
});

test.describe('Graukarten: Hilfsrahmen', () => {
  test('Das Livebild zeigt, wo die Karten hingehalten werden sollen, ein Knopf übernimmt die Rahmen', async ({
    app,
  }) => {
    await app.open();
    await app.startGrayStage();
    await expect(app.page.getByTestId('guide')).toHaveCount(2);

    await app.captureStill();
    await app.button('Eckpunkte auf Rahmen setzen').click();

    await expect(app.page.locator('svg circle')).toHaveCount(8);
    await expect(app.page.getByTestId('guide')).toHaveCount(0);
  });
});

test.describe('Graukarten: automatische Erkennung', () => {
  test.use({ lighting: 'ok' });

  test('Ein Knopf setzt die Eckpunkte beider Karten selbst', async ({ app }) => {
    await app.open();
    await app.startGrayStage();
    await app.captureStill();

    await app.button('Karten automatisch erkennen').click();

    await expect(app.page.locator('svg circle')).toHaveCount(8);
    await expect(app.page.getByTestId('detect-message')).toContainText('erkannt');
    await app.expectVerdict('Die Raumhelligkeit passt');
  });
});
