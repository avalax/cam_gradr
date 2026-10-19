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

  test('Bild und Seitenspalte haben auf Graukarten, Farbkarten und Vorschau dieselbe Größe und Lage', async ({
    app,
  }) => {
    await app.open();
    const boxes: unknown[] = [];
    for (const tab of ['Graukarten', 'Farbkarten', 'Vorschau'] as const) {
      await app.openTab(tab);
      boxes.push(
        await app.page.locator('.relative.min-w-0.flex-1').first().boundingBox(),
        await app.page.locator('.w-44').first().boundingBox(),
      );
    }
    expect(boxes[0]).not.toBeNull();
    for (const [index, box] of boxes.entries()) {
      expect(box).toEqual(boxes[index % 2]);
    }
  });

  test('Der Inhaltsbereich ist auf allen vier Tabs gleich hoch', async ({ app }) => {
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

  test('Ohne Kamera weisen die Kartentabs auf den Kameraschalter hin', async ({ app }) => {
    await app.open();

    await expect(app.page.getByText('Die Kamera ist aus')).toBeVisible();
  });
});

test.describe('Kameraschalter', () => {
  test('Der Schalter startet und stoppt die Kamera, ohne den Tab zu wechseln', async ({ app }) => {
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

  test('Die Bildfläche behält beim Kamerastart ihre Größe, nichts flackert', async ({ app }) => {
    await app.open();
    await app.openTab('Graukarten');
    // Merkt sich jede Größe der Bildfläche, die während des Starts und der Aufnahme auftritt.
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
    // Die App schaltet die Kamera nach der automatischen Aufnahme selbst aus.
    await expect(app.cameraSwitch).toHaveAttribute('aria-checked', 'false');

    await expect(app.page.locator('canvas')).toBeVisible();
    await expect(app.button('Zurück zum Livebild')).toBeVisible();
  });

  test('Jeder Tab behält sein Standbild beim Wechsel zwischen den Tabs', async ({ app }) => {
    await app.open();
    await app.startGrayStage();
    await app.captureStill();

    await app.openTab('Farbkarten');
    await expect(app.button('Zurück zum Livebild')).toHaveCount(0);
    await expect(app.page.getByText('Die Kamera ist aus')).toBeVisible();

    await app.openTab('Vorschau');
    await expect(app.button('Zurück zum Livebild')).toHaveCount(0);

    await app.openTab('Graukarten');
    await expect(app.button('Zurück zum Livebild')).toBeVisible();
  });
});
