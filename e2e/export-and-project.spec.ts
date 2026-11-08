import { labToSrgb } from '../src/color/lab';
import { sampleLut } from '../src/lut/lut';
import { parseCube } from '../src/test-support/cube-parse';
import { dummyLab } from '../src/test-support/dummy-reference';
import { cameraCode } from '../src/test-support/synthetic-camera';

import { expect, test } from './support/fixtures';
import { colorPatchCenter } from './support/synthetic-cards';

// Acceptance test of the user story:
// "As a user I export the correction as a LUT file and save my work as a project."
// The file formats, the LUT sizes, faulty files, missing reference sets and the file dialogs of
// Chrome and Edge are covered by the unit tests; here real downloads, file inputs and reloads count,
// and that the export is as tall as the preview with its look bar, which only a browser lays out.
// The browser locale is de-DE by default, so the assertions check the German interface.

const TOLERANCE = 7 / 255;
const SAMPLE_PATCHES = ['6A', '3A', '3C', '5H'];

test.describe('Export and project', () => {
  test('The .cube file corrects the camera, a loaded project brings back correction, stills and preview', async ({
    app,
  }) => {
    // The longest journey (download, save, reload, load and preview): with all tests in
    // parallel on a busy machine it can need more than the usual time limit.
    test.slow();
    await app.computeColorModel();
    await app.openTab('Vorschau');
    await expect(app.page.getByTestId('look-bar')).toBeVisible();
    const previewHeight = await app.panelHeight();
    await app.openTab('Export');
    expect(Math.abs((await app.panelHeight()) - previewHeight)).toBeLessThanOrEqual(1);
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

    const { text } = await app.saveProject();

    // The stills of the project come back with their corner points and the measuring field.
    await app.page.reload();
    await app.loadProject(text, 'mein-projekt.json');
    await expect(app.page.getByTestId('project-message')).toHaveCount(0);
    await app.openTab('Graukarten');
    await app.expectCorners();
    await expect(app.page.getByTestId('measure-marker')).toBeVisible();

    // The error report was recalculated with the reference set from the browser storage.
    await app.openTab('Farbkarten');
    await app.expectCorners();
    await app.showReport();
    await app.hideReport();

    // The preview corrects the live image again; patch 5H lies right of the divider, corrected.
    await app.openPreviewWithImage();
    await app.showCards('colors');
    const { x, y } = colorPatchCenter('5H');
    const expected = labToSrgb(dummyLab('5H')).map((value) => Math.round(value * 255));
    await app.expectPreviewColor(x, y, expected, 7);
  });
});
