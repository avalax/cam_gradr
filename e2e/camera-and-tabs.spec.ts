import { expect, test } from './support/fixtures';

// Acceptance tests for the operation: tabs, the camera switch next to the tabs and the camera
// settings in the gear menu. The browser locale is de-DE by default, so the assertions check the
// German interface.

test.describe('Tabs', () => {
  test('All tabs can be selected freely right away, the gray cards tab is open first', async ({
    app,
  }) => {
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

  test('Image and side column have the same size and position on gray cards, color cards and preview', async ({
    app,
  }) => {
    await app.open();
    const boxes: unknown[] = [];
    for (const tab of ['Graukarten', 'Farbkarten', 'Vorschau'] as const) {
      await app.openTab(tab);
      boxes.push(
        await app.page.getByTestId('image-block').first().boundingBox(),
        await app.page.locator('.w-44').first().boundingBox(),
      );
    }
    expect(boxes[0]).not.toBeNull();
    for (const [index, box] of boxes.entries()) {
      expect(box).toEqual(boxes[index % 2]);
    }
  });

  test('The content area has the same height on all four tabs', async ({ app }) => {
    await app.open();
    const heights: number[] = [];
    for (const tab of ['Graukarten', 'Farbkarten', 'Vorschau', 'Export'] as const) {
      await app.openTab(tab);
      const box = await app.page.getByRole('tabpanel').boundingBox();
      heights.push(Math.round(box?.height ?? 0));
    }
    expect(heights[0]).toBeGreaterThan(0);
    for (const height of heights) {
      expect(Math.abs(height - (heights[0] ?? 0))).toBeLessThanOrEqual(1);
    }
  });

  test('Without a camera the card tabs point to the camera switch', async ({ app }) => {
    await app.open();

    await expect(app.page.getByText('Die Kamera ist aus')).toBeVisible();
  });
});

test.describe('Camera switch', () => {
  test('The switch starts and stops the camera without changing the tab', async ({ app }) => {
    await app.open();
    await expect(app.cameraSwitch).toHaveAttribute('aria-checked', 'false');
    await expect(app.cameraSwitch).toHaveText('Kamera starten');

    await app.openTab('Vorschau');
    await app.startCamera();
    await expect(app.cameraSwitch).toHaveText('Kamera stoppen');
    await expect(app.page.getByRole('tab', { name: 'Vorschau' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await app.stopCamera();
    await expect(app.cameraSwitch).toHaveText('Kamera starten');
    await app.openTab('Graukarten');
    await expect(app.page.getByText('Die Kamera ist aus')).toBeVisible();
  });

  test('The image area keeps its size when the camera starts, nothing flickers', async ({
    app,
  }) => {
    await app.open();
    await app.openTab('Graukarten');
    // Remembers every size of the image area that occurs during the start and the capture.
    const watcher = await app.page.evaluateHandle(() => {
      const sizes: string[] = [];
      const stage = document.querySelector('.relative.min-w-0.flex-1');
      const tick = (): void => {
        const box = stage?.getBoundingClientRect();
        const size = `${String(Math.round(box?.width ?? 0))}x${String(Math.round(box?.height ?? 0))}`;
        if (sizes.at(-1) !== size) {
          sizes.push(size);
        }
        requestAnimationFrame(tick);
      };
      tick();
      return sizes;
    });
    await app.startCamera();
    await app.captureStill();
    const sizes = await watcher.jsonValue();
    expect(sizes).toHaveLength(1);
  });

  test('The camera keeps running when switching tabs', async ({ app }) => {
    await app.open();
    // The card tabs search for cards and switch the camera off after a capture, so start it where no search runs.
    await app.openTab('Vorschau');
    await app.startCamera();
    await app.openTab('Export');
    await app.openTab('Vorschau');

    await expect(app.cameraSwitch).toHaveAttribute('data-status', 'live');
  });

  test('Camera selection, resolution and the note on automatic mode are in the gear menu', async ({
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

  test('A still image stays visible after the camera is turned off', async ({ app }) => {
    await app.open();
    await app.startGrayStage();
    await app.captureStill();
    // The app turns the camera off by itself after the automatic capture.
    await expect(app.cameraSwitch).toHaveAttribute('aria-checked', 'false');

    await expect(app.page.locator('canvas')).toBeVisible();
    await expect(app.button('Eckpunkte löschen')).toBeVisible();
  });

  test('Each tab keeps its still image when switching between tabs', async ({ app }) => {
    await app.open();
    await app.startGrayStage();
    await app.captureStill();

    await app.openTab('Farbkarten');
    await expect(app.button('Eckpunkte löschen')).toHaveCount(0);
    await expect(app.page.getByText('Die Kamera ist aus')).toBeVisible();

    await app.openTab('Vorschau');
    await expect(app.button('Eckpunkte löschen')).toHaveCount(0);

    await app.openTab('Graukarten');
    await expect(app.button('Eckpunkte löschen')).toBeVisible();
  });
});
