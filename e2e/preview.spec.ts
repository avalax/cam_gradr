import { labToSrgb } from '../src/color/lab';
import { dummyLab } from '../src/test-support/dummy-reference';
import { cameraCode } from '../src/test-support/synthetic-camera';

import type { AppPage } from './support/app-page';
import { expect, test } from './support/fixtures';
import { colorPatchCenter } from './support/synthetic-cards';

// Acceptance tests of the user story, as of M4:
// "As a user I see in the preview how the color correction changes the camera image."
// The browser locale is de-DE by default, so the assertions check the German interface.

const TOLERANCE = 7;
// Image center: to the left of it (x < 640) the original is shown with the divider at 50 %, to
// the right the corrected image.
const LEFT_PATCH = '6A';
const RIGHT_PATCH = '1F';

function codes(code: readonly number[]): number[] {
  return code.map((value) => Math.round(value * 255));
}

// Waits until the preview shows the expected colors at a patch.
async function expectPatch(app: AppPage, id: string, expected: readonly number[]): Promise<void> {
  const { x, y } = colorPatchCenter(id);
  await app.expectPreviewColor(x, y, expected, TOLERANCE);
}

test.describe('Preview', () => {
  test('Without a color correction the tab shows a hint', async ({ app }) => {
    await app.open();
    await app.openTab('Vorschau');

    await expect(app.page.getByTestId('preview-no-model')).toContainText(
      'Noch keine Farbkorrektur',
    );
    await expect(app.page.getByTestId('preview-canvas')).toBeHidden();
  });

  test('The original is on the left, the corrected image on the right', async ({ app }) => {
    await app.computeColorModel();
    await app.openPreviewWithImage();
    await expect(app.page.getByTestId('preview-canvas')).toBeVisible();

    const left = dummyLab(LEFT_PATCH);
    const right = dummyLab(RIGHT_PATCH);
    await expectPatch(app, LEFT_PATCH, codes(cameraCode(left)));
    await expectPatch(app, RIGHT_PATCH, codes(labToSrgb(right)));
    // The original visibly deviates from the target, otherwise the test would not be meaningful.
    const original = codes(cameraCode(right));
    const corrected = codes(labToSrgb(right));
    const largest = Math.max(
      ...original.map((value, index) => Math.abs(value - (corrected[index] ?? 0))),
    );
    expect(largest).toBeGreaterThan(2 * TOLERANCE);
  });

  test('The divider can be moved with the keyboard', async ({ app }) => {
    await app.computeColorModel();
    await app.openPreviewWithImage();
    await app.page.getByTestId('wipe').focus();
    await app.page.keyboard.press('Home');
    await expect(app.page.getByTestId('wipe-line')).toHaveAttribute('style', /left: 0%/);

    await expectPatch(app, LEFT_PATCH, codes(labToSrgb(dummyLab(LEFT_PATCH))));

    await app.page.keyboard.press('End');
    await expectPatch(app, RIGHT_PATCH, codes(cameraCode(dummyLab(RIGHT_PATCH))));
  });

  test('The preview also works with a still image when the camera is off', async ({ app }) => {
    await app.computeColorModel();
    await app.openPreviewWithImage();
    await app.captureStill();

    await expectPatch(app, LEFT_PATCH, codes(cameraCode(dummyLab(LEFT_PATCH))));
    await expectPatch(app, RIGHT_PATCH, codes(labToSrgb(dummyLab(RIGHT_PATCH))));
  });

  test('The preview names the renderer, in Chrome it is the graphics card', async ({
    app,
  }, testInfo) => {
    await app.computeColorModel();
    await app.openTab('Vorschau');

    await expect(app.page.getByTestId('preview-renderer')).toBeVisible();
    // On some machines Firefox runs without WebGL2 and then uses the software rendering.
    const allowedByBrowser: Record<string, string[]> = {
      chrome: ['webgl2'],
      firefox: ['webgl2', 'cpu'],
    };
    const allowed = allowedByBrowser[testInfo.project.name] ?? [];
    expect(allowed).toContain(await app.previewRenderer());
  });

  test('The preview shows the image of the color measurement by default', async ({ app }) => {
    await app.computeColorModel();
    await app.openTab('Vorschau');

    await expect(app.page.getByTestId('preview-no-source')).toHaveCount(0);
    await expect(app.page.getByTestId('preview-canvas')).toBeVisible();
    await expect(app.page.getByTestId('wipe-line')).toBeVisible();
  });

  test('Next to the image the colors come first, switchable to the gray wedge and tonal ranges', async ({
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
