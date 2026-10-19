import { defineStore } from 'pinia';
import { ref } from 'vue';

import { useCameraStore } from '../camera/camera-store';
import type { StillKey, Stills } from '../camera/camera-store';
import { useChartStore, useColorChartStore } from '../chart/chart-store';
import { NEUTRAL_IDS } from '../chart/layouts';
import { downloadFile } from '../lut/download';
import { usePreviewStore } from '../lut/preview-store';
import { useReferenceStore } from '../reference/reference-store';
import { useSolveStore } from '../solve/solve-store';

import { decodeFrame, encodeFrame } from './frame-codec';
import { PROJECT_FORMAT, parseProject, serializeProject } from './project';
import type { Project } from './project';

// Prüft die Datei und entpackt ihre Standbilder, noch bevor sich etwas im Zustand ändert.
async function readProject(text: string): Promise<{ project: Project; stills: Stills | null }> {
  const project = parseProject(text);
  return { project, stills: await decodeStills(project) };
}

// Ersetzt die Standbilder; mit gespeicherten Bildern ist das Livebild nicht mehr nötig.
function applyStills(stills: Stills | null): void {
  const camera = useCameraStore();
  camera.discardStills();
  if (stills !== null) {
    camera.stop();
    camera.restoreStills(stills);
  }
}

// Stellt Eckpunkte, Messwerte und die Trennlinie der Vorschau her. Eckpunkte gelten nur zusammen mit einem
// Standbild; Dateien ohne Standbilder (auch ältere) bringen keine mit.
function applyCharts(project: Project, withStills: boolean): void {
  useChartStore().restore({
    points: withStills ? project.gray.corners : {},
    measurements: project.gray.measurements,
    rotated: project.gray.rotated,
  });
  useColorChartStore().restore({
    points: withStills ? project.color.corners : {},
    measurements: project.color.measurements,
    rotated: project.color.rotated,
  });
  usePreviewStore().setSplit(project.preview.split);
}

// Berechnet die Korrektur mit dem gewählten Referenzsatz neu oder nutzt das gespeicherte Modell.
// Liefert den Namen des Referenzsatzes, wenn er fehlt, sonst null.
async function applyCorrection(project: Project): Promise<string | null> {
  const references = useReferenceStore();
  await references.load();
  const solve = useSolveStore();
  const name = project.color.reference;
  if (name !== null) {
    references.select(name);
  }
  const reference = references.selected;
  if (reference !== null && reference.name === name) {
    // Mit vorhandenen Referenzwerten lässt sich der Fehlerbericht neu berechnen.
    solve.compute({
      measurements: project.color.measurements,
      reference,
      neutralIds: NEUTRAL_IDS,
    });
  }
  if (solve.model === null && project.model !== null) {
    solve.loadModel(project.model);
  }
  const missing = name !== null && reference?.name !== name;
  return missing ? name : null;
}

// Entpackt die Standbilder einer Projektdatei (null, wenn die Datei keine enthält).
async function decodeStills(project: Project): Promise<Stills | null> {
  if (project.stills === undefined) {
    return null;
  }
  const stills: Stills = {};
  for (const [key, encoded] of Object.entries(project.stills)) {
    stills[key as StillKey] = await decodeFrame(encoded);
  }
  return stills;
}

// Liest den aktuellen Arbeitsstand aus den Stores. Eckpunkte gehören zu einem Standbild: Ohne Standbilder
// in der Datei werden sie nicht gespeichert.
function snapshot(withCorners: boolean): Project {
  const gray = useChartStore().committed();
  const color = useColorChartStore().committed();
  const preview = usePreviewStore();
  return {
    format: PROJECT_FORMAT,
    savedAt: new Date().toISOString(),
    gray: {
      corners: withCorners ? gray.points : {},
      measurements: { ...gray.measurements },
      rotated: gray.rotated,
    },
    color: {
      corners: withCorners ? color.points : {},
      measurements: { ...color.measurements },
      rotated: color.rotated,
      reference: useReferenceStore().selectedName,
    },
    model: useSolveStore().model,
    preview: { split: preview.split },
  };
}

export const PROJECT_FILE_NAME = 'cam_gradr-projekt.json';

// Speichern und Laden des Arbeitsstands als JSON-Datei (ohne Referenzwerte der Hersteller).
export const useProjectStore = defineStore('project', () => {
  const error = ref<string | null>(null);
  const notice = ref<string | null>(null);

  // Speichert den Arbeitsstand; mit `withStills` stecken die Standbilder der Tabs in der Datei.
  async function save(options?: { withStills: boolean }): Promise<void> {
    error.value = null;
    notice.value = null;
    const withStills = options?.withStills === true;
    const project = snapshot(withStills);
    if (withStills) {
      const stills: NonNullable<Project['stills']> = {};
      for (const [key, frame] of Object.entries(useCameraStore().allStills())) {
        stills[key as StillKey] = await encodeFrame(frame);
      }
      project.stills = stills;
    }
    downloadFile(PROJECT_FILE_NAME, serializeProject(project), 'application/json');
  }

  // Übernimmt eine Projektdatei; bei einer fehlerhaften Datei bleibt der bisherige Stand erhalten.
  async function load(text: string): Promise<void> {
    notice.value = null;
    let read: { project: Project; stills: Stills | null };
    try {
      read = await readProject(text);
    } catch (error_) {
      error.value = (error_ as Error).message;
      return;
    }
    error.value = null;
    applyStills(read.stills);
    applyCharts(read.project, read.stills !== null);
    const missing = await applyCorrection(read.project);
    // Erfolgsmeldungen gibt es nicht; nur der fehlende Referenzsatz verdient einen Hinweis.
    notice.value =
      missing === null
        ? null
        : `Der Referenzsatz „${missing}“ ist nicht vorhanden; importiere ihn in den Einstellungen, um den Bericht zu sehen. Vorschau und Export nutzen das gespeicherte Modell.`;
  }

  // Schließt die Meldung.
  function dismiss(): void {
    error.value = null;
    notice.value = null;
  }

  return { error, notice, save, load, dismiss };
});
