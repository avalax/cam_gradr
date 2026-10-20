import { IDBFactory } from 'fake-indexeddb';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useCameraStore } from '../camera/camera-store';
import { useChartStore, useColorChartStore } from '../chart/chart-store';
import { NEUTRAL_IDS } from '../chart/layouts';
import type { Rgb } from '../chart/types';
import { usePreviewStore } from '../lut/preview-store';
import { setReferenceStorage, useReferenceStore } from '../reference/reference-store';
import { createIndexedDbStorage } from '../reference/storage';
import { useSolveStore } from '../solve/solve-store';
import { dummyIds, dummyLab, dummyReferenceJson } from '../test-support/dummy-reference';
import { cameraCode } from '../test-support/synthetic-camera';

import { parseProject } from './project';
import { PROJECT_FILE_NAME, useProjectStore } from './project-store';

const download = vi.hoisted(() => vi.fn());
vi.mock('../lut/download', () => ({ downloadFile: download }));

const colorMeasurements: Record<string, Rgb> = Object.fromEntries(
  dummyIds().map((id) => [id, cameraCode(dummyLab(id))]),
);
const grayMeasurements: Record<string, Rgb> = {
  G18: [0.46, 0.46, 0.46],
  G50: [0.74, 0.74, 0.74],
  'S3-0': [0.1, 0.1, 0.1],
  'S3-5': [0.85, 0.85, 0.85],
};

// Brings all stores into a complete working state and returns the saved file.
async function workedState(): Promise<string> {
  const references = useReferenceStore();
  await references.importFile('referenz.json', dummyReferenceJson('Mein Satz'));
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
    neutralIds: NEUTRAL_IDS,
  });
  usePreviewStore().setSplit(30);
  await useProjectStore().save();
  return (download.mock.calls.at(-1) as [string, string, string])[1];
}

const frame = (value: number) => ({
  width: 4,
  height: 2,
  data: new Float32Array(4 * 2 * 3).fill(value),
});

// Rotanteil des angezeigten Standbilds.
function shown(): number | undefined {
  return useCameraStore().still?.data[0];
}

describe('useProjectStore with still images', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    setReferenceStorage(createIndexedDbStorage(new IDBFactory(), 'test'));
    download.mockReset();
  });

  it('saves the still images of all tabs when requested', async () => {
    await workedState();
    const camera = useCameraStore();
    camera.still = frame(0.5);
    camera.swapStill('gray', 'color');
    camera.still = frame(0.25);
    await useProjectStore().save({ withStills: true });
    const project = parseProject((download.mock.calls.at(-1) as [string, string, string])[1]);
    expect(Object.keys(project.stills ?? {})).toHaveLength(2);
    expect(project.stills?.color).toBeDefined();
    expect(project.stills?.gray).toBeDefined();
  });

  it('saves the corner points along with still images, even while the camera is searching', async () => {
    await workedState();
    useCameraStore().still = frame(0.5);
    // During the search the store keeps the previous state; that is what gets saved.
    useChartStore().beginSearch();
    expect(useChartStore().points).toEqual({});
    await useProjectStore().save({ withStills: true });
    const project = parseProject((download.mock.calls.at(-1) as [string, string, string])[1]);
    expect(project.gray.corners).toEqual({ 3: [{ x: 1, y: 2 }] });
    expect(project.color.corners).toEqual({ 1: [{ x: 3, y: 4 }] });
    expect(Object.keys(project.gray.measurements)).toContain('G18');
  });

  it('omits the still images when the checkbox is unchecked', async () => {
    await workedState();
    useCameraStore().still = frame(0.5);
    await useProjectStore().save({ withStills: false });
    const project = parseProject((download.mock.calls.at(-1) as [string, string, string])[1]);
    expect(project.stills).toBeUndefined();
  });

  it('restores the still images on load and turns the camera off', async () => {
    await workedState();
    const camera = useCameraStore();
    camera.still = frame(0.5);
    camera.swapStill('gray', 'color');
    camera.still = frame(0.25);
    camera.swapStill('color', 'gray');
    await useProjectStore().save({ withStills: true });
    const text = (download.mock.calls.at(-1) as [string, string, string])[1];

    setActivePinia(createPinia());
    const fresh = useCameraStore();
    fresh.status = 'live';
    const project = useProjectStore();
    await project.load(text);

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
    camera.still = frame(0.5);
    await useProjectStore().load(text);
    expect(camera.status).toBe('live');
    expect(camera.still).toBeNull();
  });

  it('rejects a file with an unreadable still image and leaves the state unchanged', async () => {
    const text = await workedState();
    const raw = JSON.parse(text) as Record<string, unknown>;
    raw.stills = { gray: { width: 1, height: 1, encoding: 'rgb8-deflate-base64', data: 'AAAA' } };
    const camera = useCameraStore();
    camera.still = frame(0.5);
    const project = useProjectStore();
    await project.load(JSON.stringify(raw));
    expect(project.error).toContain('lässt sich nicht lesen');
    expect(shown()).toBeCloseTo(0.5);
  });
});

describe('useProjectStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    setReferenceStorage(createIndexedDbStorage(new IDBFactory(), 'test'));
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
    expect(project.tone).toBe(true);
    expect(Number.isNaN(Date.parse(project.savedAt))).toBe(false);
    expect(useProjectStore().notice).toBeNull();
    expect(text).not.toContain('"lab"');
  });

  it('restores the working state from the file and recomputes the report', async () => {
    const text = await workedState();
    // New, empty state as after reloading the page; the reference set stays stored.
    setActivePinia(createPinia());
    useCameraStore().still = { width: 1, height: 1, data: new Float32Array(3) };
    const project = useProjectStore();
    await project.load(text);

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

  it('closes error and notice with dismiss', async () => {
    const project = useProjectStore();
    await project.load('{"format":"x"}');
    expect(project.error).not.toBeNull();
    project.notice = 'Hinweis';
    project.dismiss();
    expect(project.error).toBeNull();
    expect(project.notice).toBeNull();
  });

  it('uses the saved model when the reference set is missing, and points that out', async () => {
    const text = await workedState();
    setActivePinia(createPinia());
    setReferenceStorage(createIndexedDbStorage(new IDBFactory(), 'andere'));
    const project = useProjectStore();
    await project.load(text);

    expect(useSolveStore().model).not.toBeNull();
    expect(useSolveStore().result).toBeNull();
    expect(project.notice).toContain('Referenzsatz „Mein Satz“ ist nicht vorhanden');
  });

  it('does not use another selected reference set for the report either', async () => {
    const text = await workedState();
    setActivePinia(createPinia());
    setReferenceStorage(createIndexedDbStorage(new IDBFactory(), 'dritte'));
    const references = useReferenceStore();
    await references.importFile('x.json', dummyReferenceJson('Anderer Satz'));
    await useProjectStore().load(text);

    expect(useSolveStore().result).toBeNull();
    expect(useSolveStore().model).not.toBeNull();
  });

  it('loads a project without reference and without model', async () => {
    const text = await workedState();
    const raw = JSON.parse(text) as { color: { reference: string | null }; model: unknown };
    raw.color.reference = null;
    raw.model = null;
    setActivePinia(createPinia());
    const project = useProjectStore();
    await project.load(JSON.stringify(raw));

    expect(project.notice).toBeNull();
    expect(useSolveStore().model).toBeNull();
  });

  it('falls back to the saved model when the recomputation is not possible', async () => {
    const text = await workedState();
    const raw = JSON.parse(text) as { color: { measurements: Record<string, Rgb> } };
    raw.color.measurements = { '1A': [0.5, 0.5, 0.5] };
    setActivePinia(createPinia());
    await useProjectStore().load(JSON.stringify(raw));

    expect(useSolveStore().result).toBeNull();
    expect(useSolveStore().model).not.toBeNull();
  });

  it('reports faulty files and leaves the previous state unchanged', async () => {
    const project = useProjectStore();
    useChartStore().restore({ points: { 3: [{ x: 5, y: 6 }] }, measurements: {}, rotated: false });
    await project.load('{"format":"anderes"}');

    expect(project.error).toContain('Unbekanntes Format');
    expect(project.notice).toBeNull();
    expect(useChartStore().points).toEqual({ 3: [{ x: 5, y: 6 }] });
  });

  it('clears an earlier error message after a successful load and save', async () => {
    const text = await workedState();
    const project = useProjectStore();
    await project.load('kaputt');
    expect(project.error).not.toBeNull();
    await project.save();
    expect(project.error).toBeNull();
    await project.load('kaputt');
    await project.load(text);
    expect(project.error).toBeNull();
  });
});

describe('the tone setting in the project', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    download.mockReset();
  });

  it('saves the setting and restores it before the recalculation', async () => {
    const references = useReferenceStore();
    await references.importFile('referenz.json', dummyReferenceJson('Mein Satz'));
    useColorChartStore().restore({ rotated: false, points: {}, measurements: colorMeasurements });
    const solve = useSolveStore();
    solve.setTone(false);
    solve.compute({
      measurements: colorMeasurements,
      reference: references.selected ?? { name: '', patches: {} },
      neutralIds: NEUTRAL_IDS,
    });
    await useProjectStore().save();
    const [, text] = download.mock.calls[0] as [string, string, string];
    expect(parseProject(text).tone).toBe(false);

    setActivePinia(createPinia());
    await useProjectStore().load(text);
    expect(useSolveStore().tone).toBe(false);
    expect(useSolveStore().model?.curves[0].xs).toEqual([0, 1]);
  });
});
