import { labToSrgb } from '../src/color/lab';
import { dummyLab } from '../src/test-support/dummy-reference';
import { cameraCode } from '../src/test-support/synthetic-camera';

import type { AppPage } from './support/app-page';
import { expect, test } from './support/fixtures';
import { colorPatchCenter } from './support/synthetic-cards';

// Acceptance test of the user story, as of M4:
// "As a user I see in the preview how the color correction changes the camera image."
// The hints, the side column and the choice of the renderer are covered by the component tests;
// here the pixels the graphics card or the software rendering really draws count.

const TOLERANCE = 7;
// Image center: to the left of it (x < 640) the original is shown with the divider at 50 %, to
// the right the corrected image.
const LEFT_PATCH = '6A';
const RIGHT_PATCH = '5H';

function codes(code: readonly number[]): number[] {
  return code.map((value) => Math.round(value * 255));
}

// Waits until the preview shows the expected colors at a patch.
async function expectPatch(app: AppPage, id: string, expected: readonly number[]): Promise<void> {
  const { x, y } = colorPatchCenter(id);
  await app.expectPreviewColor(x, y, expected, TOLERANCE);
}

// The original on the left, the corrected image on the right of the divider at 50 %.
async function expectSplitImage(app: AppPage): Promise<void> {
  await expectPatch(app, LEFT_PATCH, codes(cameraCode(dummyLab(LEFT_PATCH))));
  await expectPatch(app, RIGHT_PATCH, codes(labToSrgb(dummyLab(RIGHT_PATCH))));
}

test.describe('Preview', () => {
  test('The preview corrects the image of the color cards, the live image and a new still', async ({
    app,
  }, testInfo) => {
    // The original visibly deviates from the target, otherwise the test would not be meaningful.
    const original = codes(cameraCode(dummyLab(RIGHT_PATCH)));
    const target = codes(labToSrgb(dummyLab(RIGHT_PATCH)));
    const largest = Math.max(
      ...original.map((value, index) => Math.abs(value - (target[index] ?? 0))),
    );
    expect(largest).toBeGreaterThan(2 * TOLERANCE);

    await app.computeColorModel();
    // With the camera off the preview shows the image of the color measurement.
    await app.openTab('Vorschau');
    await expectSplitImage(app);

    await app.startCamera();
    // On some machines Firefox runs without WebGL2 and then uses the software rendering.
    const allowedByBrowser: Record<string, string[]> = {
      chrome: ['webgl2'],
      firefox: ['webgl2', 'cpu'],
    };
    expect(allowedByBrowser[testInfo.project.name] ?? []).toContain(await app.previewRenderer());
    await expectSplitImage(app);

    // A still taken in the preview is drawn again when the divider moves.
    await app.captureStill();
    await expectSplitImage(app);
    await app.page.getByTestId('wipe').focus();
    await app.page.keyboard.press('Home');
    await expectPatch(app, LEFT_PATCH, codes(labToSrgb(dummyLab(LEFT_PATCH))));
    await app.page.keyboard.press('End');
    await expectPatch(app, RIGHT_PATCH, codes(cameraCode(dummyLab(RIGHT_PATCH))));
  });
});
