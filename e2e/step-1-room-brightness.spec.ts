import { expect, test } from './support/fixtures';

// Acceptance tests of the user story (tab "Graukarten"):
// "As a user I adjust the room brightness with the gray cards until the traffic light is green."
// The browser locale is de-DE by default, so the assertions check the German interface.

test.describe('Gray cards: room is fine', () => {
  test.use({ lighting: 'ok' });

  test('The point is within the normal range', async ({ app }) => {
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

  test('The layout sits correctly on both cards', async ({ app }) => {
    await app.open();
    await app.startGrayStage();
    await app.captureStill();
    await app.expectCorners();

    // Large patches are upright; the strip sits to the left of the card for the right card (18 %)
    // and to the right of the large patch for the left card (50 %).
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

  test('Details of the measuring field appear only on hover or focus', async ({ app }) => {
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

  test('The camera image uses the space next to the controls', async ({ app }) => {
    await app.page.setViewportSize({ width: 1600, height: 1200 });
    await app.open();
    await app.startGrayStage();

    const box = await app.overlay.boundingBox();
    // Window width 1600 minus margins, frame around the content, control column (21 rem) and
    // measuring field
    expect(box?.width).toBeGreaterThan(950);
  });

  for (const [width, height] of [
    [1280, 720],
    [1366, 768],
    [1600, 700],
    [1920, 900],
  ] as const) {
    {
      test(`Image and buttons fit on one screen in the gray cards tab (${String(width)}×${String(height)})`, async ({
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

  test('Starting the camera begins a new search, stopping without a new still restores the old state', async ({
    app,
  }) => {
    await app.open();
    await app.startGrayStage();
    await app.captureStill();
    await app.expectCorners();
    await app.expectVerdict('im Normalbereich');

    // In the live image the corner points and measurement disappear so that a new still can be
    // created.
    await app.startCamera();
    await expect(app.page.locator('svg circle')).toHaveCount(0);
    await expect(app.page.getByTestId('measure-marker')).toHaveCount(0);

    // Without a new capture the previous state returns with image and corner points.
    await app.stopCamera();
    await app.expectCorners();
    await expect(app.page.locator('canvas').first()).toBeVisible();
    await app.expectVerdict('im Normalbereich');
  });

  test('"Eckpunkte löschen" restarts the automatic search from scratch', async ({ app }) => {
    await app.open();
    await app.startGrayStage();
    await app.captureStill();
    await app.expectCorners();

    await app.button('Eckpunkte löschen').click();
    await expect(app.page.locator('svg circle')).toHaveCount(0);
    await expect(app.page.getByTestId('auto-hint')).toBeVisible();
    await expect(app.page.getByTestId('measure-marker')).toHaveCount(0);

    await app.captureStill();
    await app.expectCorners();
    await app.expectVerdict('im Normalbereich');
  });
});

test.describe('Gray cards: room too dark', () => {
  test.use({ lighting: 'dark' });

  test('The traffic light asks for more light', async ({ app }) => {
    await app.open();
    await app.startGrayStage();
    await app.captureStill();
    await app.expectCorners();

    await app.expectVerdict('Helligkeit erhöhen');
  });
});

test.describe('Gray cards: room too bright', () => {
  test.use({ lighting: 'bright' });

  test('The traffic light asks for less light and reports overexposed highlights', async ({
    app,
  }) => {
    await app.open();
    await app.startGrayStage();
    await app.captureStill();
    await app.expectCorners();

    await app.expectVerdict('Helligkeit verringern');
    await expect(app.details).toContainText('überbelichtet');
    await expect(app.page.getByTestId('measure-issue')).toContainText('Helligkeit zu hoch');
  });
});

test.describe('Gray cards: automatic capture', () => {
  test.use({ lighting: 'ok' });

  test('The app captures the still by itself as soon as the cards are in the image', async ({
    app,
  }) => {
    await app.open();
    await app.startCamera();
    await app.openTab('Graukarten');
    await expect(app.page.getByTestId('auto-hint')).toBeVisible();

    await expect(app.page.locator('svg circle')).toHaveCount(8);
    await expect(app.cameraSwitch).toHaveAttribute('aria-checked', 'false');
    await expect(app.button('Eckpunkte löschen')).toBeVisible();
    await app.expectVerdict('im Normalbereich');
  });
});

test.describe('Gray cards: live outlines', () => {
  // The camera shows the cards at once and the app captures within a second, so the outlines in the
  // live image are covered by the component tests; here only the end state counts.
  test('No outlines remain after the capture', async ({ app }) => {
    await app.open();
    await app.startGrayStage();
    await app.captureStill();
    await expect(app.page.getByTestId('found-frame')).toHaveCount(0);
  });
});

test.describe('Gray cards: measuring field', () => {
  test.use({ lighting: 'ok' });

  test('The measuring field shows brightness and contrast with a point in the normal range', async ({
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
