import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';

import { useCameraStore } from '../camera/camera-store';
import { useChartStore, useColorChartStore } from '../chart/chart-store';
import type { Rgb } from '../chart/types';
import { i18n } from '../lang';
import { useLookStore } from '../look/look-store';
import { useExportStore } from '../lut/export-store';
import { usePreviewStore } from '../lut/preview-store';
import { setReferenceStorage, useReferenceStore } from '../reference/reference-store';
import { useSolveStore } from '../solve/solve-store';
import { chosenFile, notReadable } from '../test-support/chosen-file';
import { dummyReferenceJson } from '../test-support/dummy-reference';
import { failingStorage } from '../test-support/failing-storage';
import { fakeHandle, installedDialogs } from '../test-support/file-dialogs';
import { IDENTITY_MODEL } from '../test-support/identity-model';
import { INVERT_CUBE, cubeFile } from '../test-support/look-cubes';
import { syntheticMeasurements } from '../test-support/synthetic-camera';
import { emptyLookStorage, emptyReferenceStorage } from '../test-support/empty-storage';
import { grayFrame } from '../test-support/frames';

import { parseProject } from './project';
import { PROJECT_FILE_NAME, useProjectStore } from './project-store';

const download = vi.hoisted(() => vi.fn());
vi.mock('../lut/download', () => ({ downloadFile: download }));
const { fitOnce } = await vi.hoisted(() => import('../test-support/fit-once'));
vi.mock(import('../solve/fit'), async (original) => fitOnce(await original()));

// What a save without still images and look LUTs includes.
const PLAIN = { withStills: false, withLooks: false };

// A project file with this text, as the file input hands it over.
function projectFile(text: string) {
  return chosenFile('project.json', text);
}

const colorMeasurements = syntheticMeasurements();
const grayMeasurements: Record<string, Rgb> = {
  G18: [0.46, 0.46, 0.46],
  G50: [0.74, 0.74, 0.74],
  'S3-0': [0.1, 0.1, 0.1],
  'S3-5': [0.85, 0.85, 0.85],
};

// The name and the content of the file saved last.
function lastDownload(): { name: string; text: string } {
  const [name, text] = download.mock.calls.at(-1) as [string, string, string];
  return { name, text };
}

// Brings all stores into a complete working state and returns the saved file.
async function workedState(): Promise<string> {
  const references = useReferenceStore();
  await references.importChosen(chosenFile('referenz.json', dummyReferenceJson('Mein Satz')));
  useChartStore().restore({
    points: { 3: [{ x: 1, y: 2 }] },
    measurements: grayMeasurements,
    rotated: false,
  });
  useColorChartStore().restore({
    rotated: false,
    points: { 1: [{ x: 3, y: 4 }] },
    measurements: colorMeasurements,
  });
  useSolveStore().compute({
    measurements: colorMeasurements,
    reference: references.selected ?? { name: '', patches: {} },
  });
  usePreviewStore().setSplit(30);
  await useProjectStore().save(PLAIN);
  return lastDownload().text;
}

// Imports the look LUT "Warm" and chooses it at 70 %.
async function chooseWarm(): Promise<void> {
  await useLookStore().importFiles([cubeFile('Warm.cube')]);
  usePreviewStore().setStrength(70);
}

// Red share of the shown still image.
function shown(): number | undefined {
  return useCameraStore().still?.data[0];
}

describe('useProjectStore with still images', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    emptyReferenceStorage();
    download.mockReset();
  });

  it('saves the still images of all tabs when requested', async () => {
    await workedState();
    const camera = useCameraStore();
    camera.still = grayFrame(4, 2, 0.5);
    camera.swapStill('gray', 'color');
    camera.still = grayFrame(4, 2, 0.25);
    await useProjectStore().save({ withStills: true, withLooks: false });
    const project = parseProject(lastDownload().text);
    expect(Object.keys(project.stills ?? {})).toHaveLength(2);
    expect(project.stills?.color).toBeDefined();
    expect(project.stills?.gray).toBeDefined();
  });

  it('saves the corner points along with still images, even while the camera is searching', async () => {
    await workedState();
    useCameraStore().still = grayFrame(4, 2, 0.5);
    // During the search the store keeps the previous state; that is what gets saved.
    useChartStore().beginSearch();
    expect(useChartStore().points).toEqual({});
    await useProjectStore().save({ withStills: true, withLooks: false });
    const project = parseProject(lastDownload().text);
    expect(project.gray.corners).toEqual({ 3: [{ x: 1, y: 2 }] });
    expect(project.color.corners).toEqual({ 1: [{ x: 3, y: 4 }] });
    expect(Object.keys(project.gray.measurements)).toContain('G18');
  });

  it('omits the still images when the checkbox is unchecked', async () => {
    await workedState();
    useCameraStore().still = grayFrame(4, 2, 0.5);
    await useProjectStore().save(PLAIN);
    const project = parseProject(lastDownload().text);
    expect(project.stills).toBeUndefined();
  });

  it('restores the still images on load and turns the camera off', async () => {
    await workedState();
    const camera = useCameraStore();
    camera.still = grayFrame(4, 2, 0.5);
    camera.swapStill('gray', 'color');
    camera.still = grayFrame(4, 2, 0.25);
    camera.swapStill('color', 'gray');
    await useProjectStore().save({ withStills: true, withLooks: false });
    const text = lastDownload().text;

    setActivePinia(createPinia());
    const fresh = useCameraStore();
    fresh.status = 'live';
    const project = useProjectStore();
    await project.loadChosen(projectFile(text));

    expect(project.error).toBeNull();
    expect(fresh.status).toBe('idle');
    expect(fresh.stillOwner).toBe('gray');
    expect(shown()).toBeCloseTo(0.5, 2);
    expect(useChartStore().points).toEqual({ 3: [{ x: 1, y: 2 }] });
    expect(useColorChartStore().points).toEqual({ 1: [{ x: 3, y: 4 }] });
    fresh.swapStill('gray', 'color');
    expect(shown()).toBeCloseTo(0.25, 2);
  });

  it('keeps the camera on when the file contains no still images', async () => {
    const text = await workedState();
    setActivePinia(createPinia());
    const camera = useCameraStore();
    camera.status = 'live';
    camera.still = grayFrame(4, 2, 0.5);
    await useProjectStore().loadChosen(projectFile(text));
    expect(camera.status).toBe('live');
    expect(camera.still).toBeNull();
  });

  it('rejects a file with an unreadable still image and leaves the state unchanged', async () => {
    const text = await workedState();
    const raw = JSON.parse(text) as Record<string, unknown>;
    raw.stills = { gray: { width: 1, height: 1, encoding: 'rgb8-deflate-base64', data: 'AAAA' } };
    const camera = useCameraStore();
    camera.still = grayFrame(4, 2, 0.5);
    const project = useProjectStore();
    await project.loadChosen(projectFile(JSON.stringify(raw)));
    expect(project.error).toContain('lässt sich nicht lesen');
    expect(shown()).toBeCloseTo(0.5);
  });
});

describe('useProjectStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    emptyReferenceStorage();
    download.mockReset();
  });

  it('saves the working state as a JSON file (without still images also without corner points)', async () => {
    const text = await workedState();
    const [name, , mime] = download.mock.calls[0] as [string, string, string];
    expect(name).toBe(PROJECT_FILE_NAME);
    expect(mime).toBe('application/json');
    const project = parseProject(text);
    expect(project.color.reference).toBe('Mein Satz');
    expect(project.gray.measurements).toEqual(grayMeasurements);
    // Without still images in the file, no corner points belong in it either.
    expect(project.color.corners).toEqual({});
    expect(project.gray.corners).toEqual({});
    expect(project.model).not.toBeNull();
    expect(project.preview).toEqual({ split: 30 });
    expect(Number.isNaN(Date.parse(project.savedAt))).toBe(false);
    expect(useProjectStore().notice).toBeNull();
    expect(text).not.toContain('"lab"');
  });

  it('restores the working state from the file and recomputes the report', async () => {
    const text = await workedState();
    // New, empty state as after reloading the page; the reference set stays stored.
    setActivePinia(createPinia());
    useCameraStore().still = grayFrame(1, 1);
    const project = useProjectStore();
    await project.loadChosen(projectFile(text));

    expect(project.error).toBeNull();
    expect(project.notice).toBeNull();
    expect(useCameraStore().still).toBeNull();
    // The file has no still images, so no corner points come back either.
    expect(useChartStore().points).toEqual({});
    expect(useChartStore().measurements).toEqual(grayMeasurements);
    expect(useChartStore().exposure?.verdict).toBe('ok');
    expect(useColorChartStore().measurements).toEqual(colorMeasurements);
    expect(usePreviewStore().split).toBe(30);
    expect(useReferenceStore().selectedName).toBe('Mein Satz');
    expect(useSolveStore().model).not.toBeNull();
    expect(useSolveStore().result?.report.patches).toHaveLength(48);
  });

  it('saves all look LUTs with their settings on request and restores them in another browser', async () => {
    emptyLookStorage();
    await useLookStore().importFiles([cubeFile('Cold.cube')]);
    await chooseWarm();
    usePreviewStore().setLeft('corrected');
    usePreviewStore().setRight('camera');
    useExportStore().setSize(65);
    await workedState();
    await useProjectStore().save({ withStills: false, withLooks: true });
    const text = lastDownload().text;
    const saved = parseProject(text);
    expect(saved.export).toEqual({ size: 65 });
    expect({ ...saved.looks, luts: saved.looks?.luts.map((look) => look.name) }).toEqual({
      chosen: 'Warm',
      strength: 70,
      left: 'corrected',
      right: 'camera',
      luts: ['Cold', 'Warm'],
    });

    setActivePinia(createPinia());
    const other = emptyLookStorage();
    const project = useProjectStore();
    await project.loadChosen(projectFile(text));
    expect(project.notice).toBeNull();
    expect(useLookStore().looks.map((look) => look.name)).toEqual(['Cold', 'Warm']);
    expect(useLookStore().find('Warm')?.lut.size).toBe(2);
    expect(await other.list()).toHaveLength(2);
    const preview = usePreviewStore();
    expect([preview.look, preview.strength, preview.left, preview.right]).toEqual([
      'Warm',
      70,
      'corrected',
      'camera',
    ]);
    expect(useExportStore().size).toBe(65);
  });

  it('replaces a look LUT of the same name with the one from the file', async () => {
    emptyLookStorage();
    await chooseWarm();
    await workedState();
    await useProjectStore().save({ withStills: false, withLooks: true });
    const text = lastDownload().text;
    const looks = useLookStore();
    const saved = looks.find('Warm');
    await looks.importFiles([cubeFile('Warm.cube', INVERT_CUBE), cubeFile('Blue.cube')]);
    expect(looks.find('Warm')?.lut.data).not.toEqual(saved?.lut.data);
    const project = useProjectStore();
    await project.loadChosen(projectFile(text));
    expect(looks.find('Warm')?.lut.data).toEqual(saved?.lut.data);
    // Blue is not in the project.
    expect(looks.find('Blue')).toBeNull();
    expect(project.notice).toBe(
      'Eine importierte Look-LUT, die das Projekt nicht enthält, wurde aus dem Browser entfernt.',
    );
  });

  it('loads a project saved without look LUTs as if there had never been one', async () => {
    const storage = emptyLookStorage();
    await chooseWarm();
    usePreviewStore().setLeft('corrected');
    const text = await workedState();
    expect(parseProject(text).looks).toBeUndefined();
    expect(parseProject(text).export).toEqual({ size: 33 });

    useExportStore().setSize(65);
    await useLookStore().importFiles([cubeFile('Cold.cube')]);
    await useProjectStore().loadChosen(projectFile(text));
    expect(useProjectStore().notice).toContain('2 importierte Look-LUTs');
    expect(useLookStore().looks).toEqual([]);
    expect(await storage.list()).toEqual([]);
    const preview = usePreviewStore();
    expect([preview.look, preview.strength, preview.left, preview.right]).toEqual([
      null,
      100,
      'camera',
      'corrected',
    ]);
    expect(useExportStore().size).toBe(33);
  });

  it('rejects a file whose look LUT cannot be read and changes nothing', async () => {
    emptyLookStorage();
    await chooseWarm();
    await workedState();
    await useProjectStore().save({ withStills: false, withLooks: true });
    const raw = JSON.parse(lastDownload().text) as {
      looks: { luts: { data: string }[] };
    };
    raw.looks.luts[0] = { ...raw.looks.luts[0], data: 'kaputt' };
    usePreviewStore().setSplit(80);
    const project = useProjectStore();
    await project.loadChosen(projectFile(JSON.stringify(raw)));
    expect(project.error).toContain('lässt sich nicht lesen');
    expect(usePreviewStore().split).toBe(80);
    expect(useLookStore().find('Warm')).not.toBeNull();
  });

  it('drops the text of the validation when the language changes', async () => {
    const project = useProjectStore();
    await project.loadChosen(projectFile('{"format":"x"}'));
    expect(project.error).toContain('Unbekanntes Format');
    i18n.global.locale.value = 'en';
    expect(project.error).toBeNull();
  });

  it('uses the saved model when the reference set is missing, and points that out', async () => {
    const text = await workedState();
    setActivePinia(createPinia());
    emptyReferenceStorage();
    // A correction from before does not stay.
    useSolveStore().loadModel(IDENTITY_MODEL, 'Vorher');
    const project = useProjectStore();
    await project.loadChosen(projectFile(text));

    expect(useSolveStore().model).toEqual(parseProject(text).model);
    expect(useSolveStore().result).toBeNull();
    expect(useSolveStore().referenceName).toBe('Mein Satz');
    expect(project.notice).toContain('Referenzsatz „Mein Satz“ ist nicht vorhanden');
    i18n.global.locale.value = 'en';
    expect(project.notice).toContain('The reference set “Mein Satz” is not available');
    project.dismiss();
    expect(project.notice).toBeNull();
  });

  it('keeps what the reference sets report when a project loads', async () => {
    const text = await workedState();
    setActivePinia(createPinia());
    setReferenceStorage(failingStorage());
    await useReferenceStore().importChosen(chosenFile('a.json', dummyReferenceJson('Mein Satz')));
    await useProjectStore().loadChosen(projectFile(text));
    expect(useReferenceStore().selectedName).toBe('Mein Satz');
    expect(useReferenceStore().warning).toBe(
      'Gespeicherte Referenzen konnten nicht geladen werden.',
    );
  });

  it('keeps naming the missing set of a loaded correction when saving again', async () => {
    const text = await workedState();
    setActivePinia(createPinia());
    emptyReferenceStorage();
    await useProjectStore().loadChosen(projectFile(text));
    // The active set is the bundled one, but the correction was fitted with "Mein Satz".
    expect(useReferenceStore().selectedName).not.toBe('Mein Satz');
    await useProjectStore().save(PLAIN);
    const again = lastDownload().text;
    expect(parseProject(again).color.reference).toBe('Mein Satz');

    // Loaded once more, the file still brings the saved correction, not one from the active set.
    setActivePinia(createPinia());
    await useProjectStore().loadChosen(projectFile(again));
    expect(useSolveStore().model).toEqual(parseProject(text).model);
    expect(useSolveStore().result).toBeNull();
    await useProjectStore().save(PLAIN);
    const third = lastDownload().text;
    expect(parseProject(third).color.reference).toBe('Mein Satz');
  });

  it('names the active set when there is no correction yet', async () => {
    await useReferenceStore().load();
    await useProjectStore().save(PLAIN);
    const saved = lastDownload().text;
    expect(parseProject(saved).color.reference).toBe(useReferenceStore().selectedName);
    expect(parseProject(saved).model).toBeNull();
  });

  it('loads a project without reference and without model', async () => {
    const text = await workedState();
    const raw = JSON.parse(text) as { color: { reference: string | null }; model: unknown };
    raw.color.reference = null;
    raw.model = null;
    setActivePinia(createPinia());
    useSolveStore().loadModel(IDENTITY_MODEL, 'Vorher');
    const project = useProjectStore();
    await project.loadChosen(projectFile(JSON.stringify(raw)));

    expect(project.notice).toBeNull();
    expect(useSolveStore().model).toBeNull();
    expect(useSolveStore().referenceName).toBeNull();
  });

  it('falls back to the saved model when the recomputation is not possible', async () => {
    const text = await workedState();
    const raw = JSON.parse(text) as { color: { measurements: Record<string, Rgb> } };
    raw.color.measurements = { '1A': [0.5, 0.5, 0.5] };
    setActivePinia(createPinia());
    await useProjectStore().loadChosen(projectFile(JSON.stringify(raw)));

    expect(useSolveStore().result).toBeNull();
    expect(useSolveStore().model).not.toBeNull();
  });

  it('reports faulty files and leaves the previous state unchanged', async () => {
    const project = useProjectStore();
    useChartStore().restore({ points: { 3: [{ x: 5, y: 6 }] }, measurements: {}, rotated: false });
    await project.loadChosen(projectFile('{"format":"anderes"}'));

    expect(project.error).toContain('Unbekanntes Format');
    expect(project.notice).toBeNull();
    expect(useChartStore().points).toEqual({ 3: [{ x: 5, y: 6 }] });
  });

  it('clears an earlier error message after a successful load and save', async () => {
    const text = await workedState();
    const project = useProjectStore();
    await project.loadChosen(projectFile('kaputt'));
    expect(project.error).not.toBeNull();
    await project.save(PLAIN);
    expect(project.error).toBeNull();
    expect(project.notice).toBeNull();
    await project.loadChosen(projectFile('kaputt'));
    await project.loadChosen(projectFile(text));
    expect(project.error).toBeNull();
  });
});

describe('the project file that saving suggests', () => {
  const globals = globalThis as unknown as Record<string, unknown>;
  // The store hands what the browser throws to the console.
  let warn: MockInstance<typeof console.warn>;

  beforeEach(() => {
    setActivePinia(createPinia());
    emptyReferenceStorage();
    download.mockReset();
    warn = vi.spyOn(console, 'warn').mockReturnValue();
  });

  afterEach(() => {
    delete globals.showOpenFilePicker;
    delete globals.showSaveFilePicker;
    warn.mockRestore();
  });

  it('saves under the name of the loaded file', async () => {
    const text = await workedState();
    const project = useProjectStore();
    await project.loadChosen(chosenFile('mein-projekt.json', text));
    await project.save(PLAIN);
    expect(lastDownload().name).toBe('mein-projekt.json');
  });

  it('does not take the name of a faulty file', async () => {
    const project = useProjectStore();
    await project.loadChosen(chosenFile('kaputt.json', '{"format":"x"}'));
    await project.save(PLAIN);
    expect(lastDownload().name).toBe(PROJECT_FILE_NAME);
  });

  it('opens a file in the system dialog and saves it there again', async () => {
    const text = await workedState();
    const opened = fakeHandle('mein-projekt.json', text);
    const chosen = fakeHandle('mein-projekt.json');
    const showSaveFilePicker = vi.fn().mockResolvedValue(chosen.handle);
    Object.assign(globals, {
      showOpenFilePicker: vi.fn().mockResolvedValue([opened.handle]),
      showSaveFilePicker,
    });
    const project = useProjectStore();
    await project.open(installedDialogs());
    expect(project.error).toBeNull();
    await project.save(PLAIN);
    expect(showSaveFilePicker).toHaveBeenCalledWith(
      expect.objectContaining({ suggestedName: 'mein-projekt.json', startIn: opened.handle }),
    );
    expect(chosen.written).toHaveLength(1);
    // The next save starts in the folder of the file just written.
    await project.save(PLAIN);
    expect(showSaveFilePicker).toHaveBeenLastCalledWith(
      expect.objectContaining({ startIn: chosen.handle }),
    );
  });

  it('keeps everything as it is when a dialog is cancelled', async () => {
    const abort = new DOMException('The user aborted a request.', 'AbortError');
    const showSaveFilePicker = vi.fn().mockRejectedValue(abort);
    Object.assign(globals, {
      showOpenFilePicker: vi.fn().mockRejectedValue(abort),
      showSaveFilePicker,
    });
    const project = useProjectStore();
    await project.open(installedDialogs());
    await project.save(PLAIN);
    await project.save(PLAIN);
    // Neither dialog left a file behind: saving still suggests the default name, in no folder.
    const [options] = showSaveFilePicker.mock.lastCall as [
      { suggestedName: string; startIn?: FileSystemFileHandle },
    ];
    expect(options.suggestedName).toBe(PROJECT_FILE_NAME);
    expect(options.startIn).toBeUndefined();
    expect(project.error).toBeNull();
  });

  it('names why a file cannot be opened or saved in its own words, the browser in the console', async () => {
    const denied = new DOMException(
      'The request is not allowed by the user agent or the platform in the current context.',
      'NotAllowedError',
    );
    const full = new DOMException('Quota exceeded.', 'QuotaExceededError');
    Object.assign(globals, {
      showOpenFilePicker: vi.fn().mockRejectedValue(denied),
      showSaveFilePicker: vi
        .fn()
        .mockRejectedValueOnce(full)
        .mockRejectedValueOnce(new DOMException('The operation failed.', 'UnknownError')),
    });
    const project = useProjectStore();
    await project.open(installedDialogs());
    expect(project.error).toBe(
      'Die Projektdatei ließ sich nicht öffnen. Der Browser hat den Zugriff auf die Datei verweigert.',
    );
    expect(warn).toHaveBeenLastCalledWith(denied);
    await project.save(PLAIN);
    expect(project.error).toBe(
      'Das Projekt ließ sich nicht speichern. Auf dem Laufwerk ist kein Platz mehr frei.',
    );
    i18n.global.locale.value = 'en';
    expect(project.error).toBe(
      'The project could not be saved. There is no space left on the drive.',
    );
    // An error that names no reason leaves only what failed.
    await project.save(PLAIN);
    expect(project.error).toBe('The project could not be saved.');
  });

  it('names a file the browser cannot read without the text of the browser', async () => {
    const gone = fakeHandle('mein-projekt.json', notReadable());
    Object.assign(globals, {
      showOpenFilePicker: vi.fn().mockResolvedValue([gone.handle]),
      showSaveFilePicker: vi.fn(),
    });
    const project = useProjectStore();
    await project.open(installedDialogs());
    expect(project.error).toBe('Die Datei lässt sich nicht lesen.');
    i18n.global.locale.value = 'en';
    expect(project.error).toBe('The file cannot be read.');
  });

  it('drops the notices of the file loaded before when the next one cannot be opened', async () => {
    const text = await workedState();
    // In a fresh browser the reference set of the file is missing, which deserves a notice.
    setActivePinia(createPinia());
    emptyReferenceStorage();
    const project = useProjectStore();
    await project.loadChosen(projectFile(text));
    expect(project.notice).not.toBeNull();
    Object.assign(globals, {
      showOpenFilePicker: vi.fn().mockRejectedValue(new DOMException('', 'NotAllowedError')),
      showSaveFilePicker: vi.fn(),
    });
    await project.open(installedDialogs());
    expect(project.notice).toBeNull();
    expect(project.error).toContain('Zugriff auf die Datei verweigert');
  });
});
