import { labToSrgb } from '../src/color/lab';
import { dummyLab, dummyReferenceJson } from '../src/test-support/dummy-reference';
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

async function pixelOf(app: AppPage, id: string): Promise<[number, number, number]> {
  const { x, y } = colorPatchCenter(id);
  return app.previewPixel(x, y);
}

// Wartet, bis die Vorschau an einem Feld die erwarteten Farben zeigt.
async function expectPatch(app: AppPage, id: string, expected: readonly number[]): Promise<void> {
  await expect
    .poll(async () => {
      const actual = await pixelOf(app, id);
      return expected.every((value, index) => Math.abs((actual[index] ?? 0) - value) <= TOLERANCE);
    })
    .toBe(true);
}

// Kamera an, Graukarten, Referenzwerte, Farbkarten aufnehmen und berechnen, dann in die Vorschau.
async function prepareModel(app: AppPage): Promise<void> {
  await app.completeStepOne();
  await app.importReference('referenz.json', dummyReferenceJson());
  await app.captureColorCards();
  await app.button('Farbkorrektur berechnen').click();
  await expect(app.page.getByTestId('report')).toBeVisible();
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
    await prepareModel(app);
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
    await prepareModel(app);
    await app.openTab('Vorschau');
    await app.page.getByTestId('strength').fill('0');

    await expectPatch(app, RIGHT_PATCH, codes(cameraCode(dummyLab(RIGHT_PATCH))));
  });

  test('Die Trennlinie lässt sich verschieben', async ({ app }) => {
    await prepareModel(app);
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
    await prepareModel(app);
    await app.openTab('Kamera');
    await app.button('Kamera aus').click();
    await app.openTab('Vorschau');

    await expectPatch(app, LEFT_PATCH, codes(cameraCode(dummyLab(LEFT_PATCH))));
    await expectPatch(app, RIGHT_PATCH, codes(labToSrgb(dummyLab(RIGHT_PATCH))));
  });

  test('Die Vorschau weist auf eine fehlende Bildquelle hin', async ({ app }) => {
    await prepareModel(app);
    await app.openTab('Kamera');
    await app.button('Kamera aus').click();
    await app.button('Standbild verwerfen').click();
    await app.openTab('Vorschau');

    await expect(app.page.getByTestId('preview-no-source')).toBeVisible();
  });
});
