import { labToSrgb } from '../src/color/lab';
import { sampleLut } from '../src/lut/lut';
import { parseCube } from '../src/test-support/cube-parse';
import { dummyLab } from '../src/test-support/dummy-reference';
import { cameraCode } from '../src/test-support/synthetic-camera';

import { expect, test } from './support/fixtures';
import { colorPatchCenter } from './support/synthetic-cards';

// Acceptance tests of the user story, as of M5:
// "As a user I export the correction as a LUT file and save my work as a project."
// The file formats, the LUT sizes, faulty files, missing reference sets and the file dialogs of
// Chrome and Edge are covered by the unit tests; here real downloads, file inputs and reloads count.
// The browser locale is de-DE by default, so the assertions check the German interface.

const TOLERANCE = 7 / 255;
const SAMPLE_PATCHES = ['6A', '3A', '3C', '5H'];

test.describe('Export and project', () => {
  test('The .cube file corrects the camera, a loaded project brings back correction, stills and preview', async ({
    app,
  }) => {
    await app.computeColorModel();
    await app.openTab('Export');
    const { fileName, text: cubeText } = await app.download(
      app.page.getByTestId('export-download'),
    );
    expect(fileName).toBe('cam_gradr-33.cube');
    const cube = parseCube(cubeText);
    // The file undoes the distortion of the camera: camera value in, target value out.
    for (const id of SAMPLE_PATCHES) {
      const lab = dummyLab(id);
      const corrected = sampleLut(cube.lut, cameraCode(lab));
      const expected = labToSrgb(lab);
      for (const [index, value] of expected.entries()) {
        expect(Math.abs((corrected[index] ?? 0) - value)).toBeLessThanOrEqual(TOLERANCE);
      }
    }

    await app.openPreviewWithImage();
    // Set the divider to 30 % with the keyboard (Home, then Shift + Arrow Right three times).
    await app.page.getByTestId('wipe').focus();
    await app.page.keyboard.press('Home');
    for (let step = 0; step < 3; step++) {
      await app.page.keyboard.press('Shift+ArrowRight');
    }
    await expect(app.page.getByTestId('wipe')).toHaveAttribute('aria-valuenow', '30');
    const { text } = await app.saveProject();

    // Loading the stills of the project turns a running camera off.
    await app.page.reload();
    await app.openPreviewWithImage();
    await app.loadProject(text, 'mein-projekt.json');
    await expect(app.page.getByTestId('project-message')).toHaveCount(0);
    await expect(app.cameraSwitch).toHaveAttribute('aria-checked', 'false');

    // The stills come back with their corner points; a new search hides them, and without a new
    // capture they return.
    await app.openTab('Graukarten');
    await app.expectCorners();
    await expect(app.page.getByTestId('measure-marker')).toBeVisible();
    await app.chooseCards('empty');
    await app.startCamera();
    await expect(app.page.locator('svg circle')).toHaveCount(0);
    await expect(app.page.getByTestId('measure-marker')).toHaveCount(0);
    await app.stopCamera();
    await app.expectCorners();
    await expect(app.page.getByTestId('measure-marker')).toBeVisible();

    // The error report was recalculated with the reference set from the browser storage.
    await app.openTab('Farbkarten');
    await app.expectCorners();
    await app.showReport();
    await app.hideReport();

    // The preview corrects the live image again; at 30 % patch 5H lies on the corrected side.
    await app.openPreviewWithImage();
    await app.showCards('colors');
    const { x, y } = colorPatchCenter('5H');
    const expected = labToSrgb(dummyLab('5H')).map((value) => Math.round(value * 255));
    await app.expectPreviewColor(x, y, expected, 7);

    // Saving again suggests the name of the loaded file and keeps the divider.
    const resaved = await app.saveProject();
    expect(resaved.fileName).toBe('mein-projekt.json');
    expect(resaved.text).toMatch(/"split": 30/);
  });
});
