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
      'noch keine Farbkorrektur',
    );
    await expect(app.page.getByTestId('preview-canvas')).toBeHidden();
  });

  test('Links steht das Original, rechts das korrigierte Bild', async ({ app }) => {
    await app.computeColorModel();
    await app.openTab('Vorschau');
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

  test('Stärke 0 zeigt überall das Original', async ({ app }) => {
    await app.computeColorModel();
    await app.openTab('Vorschau');
    await app.page.getByTestId('strength').fill('0');

    await expectPatch(app, RIGHT_PATCH, codes(cameraCode(dummyLab(RIGHT_PATCH))));
  });

  test('Die Trennlinie lässt sich verschieben', async ({ app }) => {
    await app.computeColorModel();
    await app.openTab('Vorschau');
    await app.page.getByTestId('split').fill('0');
    await expect(app.page.getByTestId('split-line')).toHaveAttribute('style', /left: 0%/);

    await expectPatch(app, LEFT_PATCH, codes(labToSrgb(dummyLab(LEFT_PATCH))));

    await app.page.getByTestId('split').fill('100');
    await expectPatch(app, RIGHT_PATCH, codes(cameraCode(dummyLab(RIGHT_PATCH))));
  });

  test('Die Vorschau funktioniert auch mit einem Standbild bei ausgeschalteter Kamera', async ({
    app,
  }) => {
    await app.computeColorModel();
    await app.openTab('Kamera');
    await app.button('Kamera aus').click();
    await app.openTab('Vorschau');

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
    await app.openTab('Kamera');
    await app.button('Kamera aus').click();
    await app.button('Standbild verwerfen').click();
    await app.openTab('Vorschau');

    await expect(app.page.getByTestId('preview-no-source')).toBeVisible();
  });
});
