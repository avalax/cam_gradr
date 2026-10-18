import { labToSrgb } from '../src/color/lab';
import { sampleLut } from '../src/lut/lut';
import { parseCube } from '../src/test-support/cube-parse';
import { dummyLab } from '../src/test-support/dummy-reference';
import { cameraCode } from '../src/test-support/synthetic-camera';

import { expect, test } from './support/fixtures';
import { colorPatchCenter } from './support/synthetic-cards';

// Akzeptanztests der User Story, Stand M5:
// "Als Anwender exportiere ich die Korrektur als LUT-Datei und sichere meinen Arbeitsstand als Projekt."

const TOLERANCE = 7 / 255;
const SAMPLE_PATCHES = ['6A', '1F', '3C', '5H'];

test.describe('Export', () => {
  test('Ohne Farbkorrektur zeigt der Tab einen Hinweis', async ({ app }) => {
    await app.open();
    await app.openTab('Export');

    await expect(app.page.getByTestId('export-no-model')).toContainText('noch keine Farbkorrektur');
    await expect(app.page.getByTestId('export-download')).toHaveCount(0);
  });

  test('Die heruntergeladene .cube-Datei korrigiert die Farben', async ({ app }) => {
    await app.computeColorModel();
    await app.openTab('Export');
    await expect(app.page.getByTestId('export-download')).toContainText('cam_gradr-33.cube');

    const { fileName, text } = await app.download(app.page.getByTestId('export-download'));

    expect(fileName).toBe('cam_gradr-33.cube');
    expect(text.startsWith('# Erzeugt von cam_gradr')).toBe(true);
    const cube = parseCube(text);
    expect(cube.lut.size).toBe(33);
    expect(cube.lut.data).toHaveLength(33 ** 3 * 3);
    // Die Datei macht die Verfälschung der Kamera rückgängig: Kamerawert rein, Sollwert raus.
    for (const id of SAMPLE_PATCHES) {
      const lab = dummyLab(id);
      const corrected = sampleLut(cube.lut, cameraCode(lab));
      const expected = labToSrgb(lab);
      for (const [index, value] of expected.entries()) {
        expect(Math.abs((corrected[index] ?? 0) - value)).toBeLessThanOrEqual(TOLERANCE);
      }
    }
    await expect(app.page.getByTestId('export-saved')).toContainText('cam_gradr-33.cube');
  });

  test('Die Größe der LUT ist wählbar', async ({ app }) => {
    await app.computeColorModel();
    await app.openTab('Export');
    await app.page.getByTestId('export-size').selectOption('17');

    const { fileName, text } = await app.download(app.page.getByTestId('export-download'));

    expect(fileName).toBe('cam_gradr-17.cube');
    expect(parseCube(text).lut.size).toBe(17);
  });
});

test.describe('Projekt', () => {
  test('Speichern und nach dem Neuladen wieder laden stellt Korrektur und Vorschau her', async ({
    app,
  }) => {
    await app.computeColorModel();
    await app.openPreviewWithImage();
    // Trennlinie per Tastatur auf 30 % setzen (Pos1, dann dreimal Umschalt + Pfeil rechts).
    await app.page.getByTestId('wipe').focus();
    await app.page.keyboard.press('Home');
    for (let step = 0; step < 3; step++) {
      await app.page.keyboard.press('Shift+ArrowRight');
    }
    await expect(app.page.getByTestId('wipe')).toHaveAttribute('aria-valuenow', '30');

    const { fileName, text } = await app.saveProject();
    expect(fileName).toBe('cam_gradr-projekt.json');
    // Herstellerdaten (Referenzwerte) stehen nicht in der Datei, nur der Name des Satzes.
    expect(text).not.toContain('"lab"');
    expect(text).toContain('"format": "cam_gradr-project/1"');
    expect(text).toContain('"reference": "Testdaten"');

    await app.page.reload();
    await app.loadProject(text);
    await expect(app.page.getByTestId('project-notice')).toHaveText('Projekt geladen.');

    // Der Fehlerbericht wurde mit dem gespeicherten Referenzsatz neu berechnet.
    await app.openTab('Farbkarten');
    await expect(app.page.getByTestId('report')).toBeVisible();
    // Vorschau und Einstellungen sind zurück, ohne dass etwas neu aufgenommen werden muss.
    await app.openPreviewWithImage();
    await expect(app.page.getByTestId('preview-no-model')).toHaveCount(0);
    // Der Wischer erscheint erst mit Bildquelle; die Lage der Trennlinie steckt wieder im Projekt.
    const resaved = await app.saveProject();
    expect(resaved.text).toMatch(/"split": 30/);
    expect(resaved.text).not.toContain('strength');
    await app.openTab('Export');
    await expect(app.page.getByTestId('export-download')).toBeVisible();
  });

  test('Ohne den Referenzsatz bleibt das gespeicherte Modell nutzbar', async ({ app }) => {
    await app.computeColorModel();
    const { text } = await app.saveProject();

    await app.page.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const request = indexedDB.deleteDatabase('avalax.cam_gradr');
          request.addEventListener('success', () => {
            resolve();
          });
          request.addEventListener('error', () => {
            reject(new Error('Datenbank konnte nicht gelöscht werden.'));
          });
        }),
    );
    await app.page.reload();
    await app.loadProject(text);

    await expect(app.page.getByTestId('project-notice')).toContainText('nicht vorhanden');
    await app.openTab('Farbkarten');
    await expect(app.page.getByTestId('report')).toHaveCount(0);
    await app.openTab('Export');
    await expect(app.page.getByTestId('export-download')).toBeVisible();
  });

  test('Eine fehlerhafte Projektdatei wird abgelehnt', async ({ app }) => {
    await app.open();
    await app.loadProject('{"format":"anderes-format"}');

    await expect(app.page.getByTestId('project-error')).toContainText('Unbekanntes Format');
    await expect(app.page.getByTestId('project-notice')).toHaveCount(0);
  });

  test('Das Projekt lässt sich auch ohne Farbkorrektur speichern und laden', async ({ app }) => {
    await app.open();
    const { text } = await app.saveProject();
    await app.page.reload();
    await app.loadProject(text);

    await expect(app.page.getByTestId('project-notice')).toHaveText('Projekt geladen.');
    await app.openTab('Export');
    await expect(app.page.getByTestId('export-no-model')).toBeVisible();
  });

  test('Die Vorschau funktioniert nach dem Laden des Projekts', async ({ app }) => {
    await app.computeColorModel();
    const { text } = await app.saveProject();
    await app.page.reload();
    await app.loadProject(text);
    await app.startCamera();
    await app.showCards('colors');
    await app.openPreviewWithImage();

    const patch = '1F';
    const { x, y } = colorPatchCenter(patch);
    const expected = labToSrgb(dummyLab(patch)).map((value) => Math.round(value * 255));
    await app.expectPreviewColor(x, y, expected, 7);
  });
});
