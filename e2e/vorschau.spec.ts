import { labToSrgb } from '../src/color/lab';
import { dummyLab } from '../src/test-support/dummy-reference';
import { cameraCode } from '../src/test-support/synthetic-camera';

import type { AppPage } from './support/app-page';
import { expect, test } from './support/fixtures';
import { colorPatchCenter } from './support/synthetic-cards';

// Akzeptanztests der User Story, Stand M4:
// "Als Anwender sehe ich in der Vorschau, wie die Farbkorrektur das Kamerabild verändert."

const TOLERANCE = 7;
// Bildmitte: links davon (x < 640) steht bei Trennlinie 50 % das Original, rechts das korrigierte Bild.
const LEFT_PATCH = '6A';
const RIGHT_PATCH = '1F';

function codes(code: readonly number[]): number[] {
  return code.map((value) => Math.round(value * 255));
}

// Wartet, bis die Vorschau an einem Feld die erwarteten Farben zeigt.
async function expectPatch(app: AppPage, id: string, expected: readonly number[]): Promise<void> {
  const { x, y } = colorPatchCenter(id);
  await app.expectPreviewColor(x, y, expected, TOLERANCE);
}

test.describe('Vorschau', () => {
  test('Ohne Farbkorrektur zeigt der Tab einen Hinweis', async ({ app }) => {
    await app.open();
    await app.openTab('Vorschau');

    await expect(app.page.getByTestId('preview-no-model')).toContainText(
      'Noch keine Farbkorrektur',
    );
    await expect(app.page.getByTestId('preview-canvas')).toBeHidden();
  });

  test('Links steht das Original, rechts das korrigierte Bild', async ({ app }) => {
    await app.computeColorModel();
    await app.openPreviewWithImage();
    await expect(app.page.getByTestId('preview-canvas')).toBeVisible();

    const left = dummyLab(LEFT_PATCH);
    const right = dummyLab(RIGHT_PATCH);
    await expectPatch(app, LEFT_PATCH, codes(cameraCode(left)));
    await expectPatch(app, RIGHT_PATCH, codes(labToSrgb(right)));
    // Das Original weicht sichtbar vom Soll ab, sonst wäre der Test nicht aussagekräftig.
    const original = codes(cameraCode(right));
    const corrected = codes(labToSrgb(right));
    const largest = Math.max(
      ...original.map((value, index) => Math.abs(value - (corrected[index] ?? 0))),
    );
    expect(largest).toBeGreaterThan(2 * TOLERANCE);
  });

  test('Die Trennlinie lässt sich per Tastatur verschieben', async ({ app }) => {
    await app.computeColorModel();
    await app.openPreviewWithImage();
    await app.page.getByTestId('wipe').focus();
    await app.page.keyboard.press('Home');
    await expect(app.page.getByTestId('wipe-line')).toHaveAttribute('style', /left: 0%/);

    await expectPatch(app, LEFT_PATCH, codes(labToSrgb(dummyLab(LEFT_PATCH))));

    await app.page.keyboard.press('End');
    await expectPatch(app, RIGHT_PATCH, codes(cameraCode(dummyLab(RIGHT_PATCH))));
  });

  test('Die Vorschau funktioniert auch mit einem Standbild bei ausgeschalteter Kamera', async ({
    app,
  }) => {
    await app.computeColorModel();
    await app.openPreviewWithImage();
    await app.captureStill();

    await expectPatch(app, LEFT_PATCH, codes(cameraCode(dummyLab(LEFT_PATCH))));
    await expectPatch(app, RIGHT_PATCH, codes(labToSrgb(dummyLab(RIGHT_PATCH))));
  });

  test('Die Vorschau nennt die Darstellungsart, in Chrome ist es die Grafikkarte', async ({
    app,
  }, testInfo) => {
    await app.computeColorModel();
    await app.openTab('Vorschau');

    await expect(app.page.getByTestId('preview-renderer')).toBeVisible();
    // Firefox läuft auf manchen Rechnern ohne WebGL2 und nutzt dann die Software-Darstellung.
    const allowedByBrowser: Record<string, string[]> = {
      chrome: ['webgl2'],
      firefox: ['webgl2', 'cpu'],
    };
    const allowed = allowedByBrowser[testInfo.project.name] ?? [];
    expect(allowed).toContain(await app.previewRenderer());
  });

  test('Die Vorschau weist auf eine fehlende Bildquelle hin', async ({ app }) => {
    await app.computeColorModel();
    await app.openTab('Vorschau');

    await expect(app.page.getByTestId('preview-no-source')).toBeVisible();
  });

  test('Neben dem Bild stehen zuerst die Farben, dazu umschaltbar Graukeil und Tonbereiche', async ({
    app,
  }) => {
    await app.computeColorModel();
    await app.openTab('Vorschau');

    await expect(app.page.getByTestId('color-tiles')).toBeVisible();
    await expect(app.page.locator('[data-testid="color-tiles"] [data-patch]')).toHaveCount(36);
    await expect(app.page.getByTestId('worst-patches')).toContainText('Größte Abweichung');
    await expect(app.page.getByTestId('preview-summary')).toContainText('Ø Abweichung');

    await app.page.getByTestId('view-grays').click();
    await expect(app.page.getByTestId('gray-wedge')).toBeVisible();
    await expect(app.page.locator('[data-column="camera"] [data-patch]')).toHaveCount(12);
    const changes = app.page.getByTestId('zone-changes');
    await expect(changes).toContainText('Schatten');
    await expect(changes).toContainText('Mitten');
    await expect(changes).toContainText('Lichter');
  });
});
