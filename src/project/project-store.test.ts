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

// Bringt alle Stores in einen vollständigen Arbeitsstand und liefert die gespeicherte Datei.
async function workedState(): Promise<string> {
  const references = useReferenceStore();
  await references.importFile('referenz.json', dummyReferenceJson('Mein Satz'));
  useChartStore().restore({ points: { 3: [{ x: 1, y: 2 }] }, measurements: grayMeasurements });
  useColorChartStore().restore({
    points: { 1: [{ x: 3, y: 4 }] },
    measurements: colorMeasurements,
  });
  useSolveStore().compute({
    measurements: colorMeasurements,
    reference: references.selected ?? { name: '', patches: {} },
    neutralIds: NEUTRAL_IDS,
  });
  usePreviewStore().setStrength(70);
  usePreviewStore().setSplit(30);
  useProjectStore().save();
  return (download.mock.calls.at(-1) as [string, string, string])[1];
}

describe('useProjectStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    setReferenceStorage(createIndexedDbStorage(new IDBFactory(), 'test'));
    download.mockReset();
  });

  it('speichert den Arbeitsstand als JSON-Datei', async () => {
    const text = await workedState();
    const [name, , mime] = download.mock.calls[0] as [string, string, string];
    expect(name).toBe(PROJECT_FILE_NAME);
    expect(mime).toBe('application/json');
    const project = parseProject(text);
    expect(project.color.reference).toBe('Mein Satz');
    expect(project.gray.measurements).toEqual(grayMeasurements);
    expect(project.color.corners).toEqual({ 1: [{ x: 3, y: 4 }] });
    expect(project.model).not.toBeNull();
    expect(project.preview).toEqual({ strength: 70, split: 30 });
    expect(Number.isNaN(Date.parse(project.savedAt))).toBe(false);
    expect(useProjectStore().notice).toContain('gespeichert');
    expect(text).not.toContain('"lab"');
  });

  it('stellt den Arbeitsstand aus der Datei wieder her und berechnet den Bericht neu', async () => {
    const text = await workedState();
    // Neuer, leerer Zustand wie nach dem Neuladen der Seite; der Referenzsatz bleibt gespeichert.
    setActivePinia(createPinia());
    useCameraStore().still = { width: 1, height: 1, data: new Float32Array(3) };
    const project = useProjectStore();
    await project.load(text);

    expect(project.error).toBeNull();
    expect(project.notice).toBe('Projekt geladen.');
    expect(useCameraStore().still).toBeNull();
    expect(useChartStore().points).toEqual({ 3: [{ x: 1, y: 2 }] });
    expect(useChartStore().measurements).toEqual(grayMeasurements);
    expect(useChartStore().exposure?.verdict).toBe('ok');
    expect(useColorChartStore().measurements).toEqual(colorMeasurements);
    expect(usePreviewStore().strength).toBe(70);
    expect(usePreviewStore().split).toBe(30);
    expect(useReferenceStore().selectedName).toBe('Mein Satz');
    expect(useSolveStore().model).not.toBeNull();
    expect(useSolveStore().result?.report.patches).toHaveLength(48);
  });

  it('nutzt das gespeicherte Modell, wenn der Referenzsatz fehlt, und weist darauf hin', async () => {
    const text = await workedState();
    setActivePinia(createPinia());
    setReferenceStorage(createIndexedDbStorage(new IDBFactory(), 'andere'));
    const project = useProjectStore();
    await project.load(text);

    expect(useSolveStore().model).not.toBeNull();
    expect(useSolveStore().result).toBeNull();
    expect(project.notice).toContain('Referenzsatz „Mein Satz“ ist nicht vorhanden');
  });

  it('nimmt auch ein anderes gewähltes Referenzset nicht für den Bericht', async () => {
    const text = await workedState();
    setActivePinia(createPinia());
    setReferenceStorage(createIndexedDbStorage(new IDBFactory(), 'dritte'));
    const references = useReferenceStore();
    await references.importFile('x.json', dummyReferenceJson('Anderer Satz'));
    await useProjectStore().load(text);

    expect(useSolveStore().result).toBeNull();
    expect(useSolveStore().model).not.toBeNull();
  });

  it('lädt ein Projekt ohne Referenz und ohne Modell', async () => {
    const text = await workedState();
    const raw = JSON.parse(text) as { color: { reference: string | null }; model: unknown };
    raw.color.reference = null;
    raw.model = null;
    setActivePinia(createPinia());
    const project = useProjectStore();
    await project.load(JSON.stringify(raw));

    expect(project.notice).toBe('Projekt geladen.');
    expect(useSolveStore().model).toBeNull();
  });

  it('fällt auf das gespeicherte Modell zurück, wenn die Neuberechnung nicht möglich ist', async () => {
    const text = await workedState();
    const raw = JSON.parse(text) as { color: { measurements: Record<string, Rgb> } };
    raw.color.measurements = { '1A': [0.5, 0.5, 0.5] };
    setActivePinia(createPinia());
    await useProjectStore().load(JSON.stringify(raw));

    expect(useSolveStore().result).toBeNull();
    expect(useSolveStore().model).not.toBeNull();
  });

  it('meldet fehlerhafte Dateien und lässt den bisherigen Stand unverändert', async () => {
    const project = useProjectStore();
    useChartStore().restore({ points: { 3: [{ x: 5, y: 6 }] }, measurements: {} });
    await project.load('{"format":"anderes"}');

    expect(project.error).toContain('Unbekanntes Format');
    expect(project.notice).toBeNull();
    expect(useChartStore().points).toEqual({ 3: [{ x: 5, y: 6 }] });
  });

  it('löscht eine frühere Fehlermeldung nach erfolgreichem Laden und Speichern', async () => {
    const text = await workedState();
    const project = useProjectStore();
    await project.load('kaputt');
    expect(project.error).not.toBeNull();
    project.save();
    expect(project.error).toBeNull();
    await project.load('kaputt');
    await project.load(text);
    expect(project.error).toBeNull();
  });
});
