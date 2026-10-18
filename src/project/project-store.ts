import { defineStore } from 'pinia';
import { ref } from 'vue';

import { useCameraStore } from '../camera/camera-store';
import { useChartStore, useColorChartStore } from '../chart/chart-store';
import { NEUTRAL_IDS } from '../chart/layouts';
import { downloadFile } from '../lut/download';
import { usePreviewStore } from '../lut/preview-store';
import { useReferenceStore } from '../reference/reference-store';
import { useSolveStore } from '../solve/solve-store';

import { PROJECT_FORMAT, parseProject, serializeProject } from './project';
import type { Project } from './project';

// Liest den aktuellen Arbeitsstand aus den Stores.
function snapshot(): Project {
  const gray = useChartStore();
  const color = useColorChartStore();
  const preview = usePreviewStore();
  return {
    format: PROJECT_FORMAT,
    savedAt: new Date().toISOString(),
    gray: {
      corners: gray.points,
      measurements: { ...gray.measurements },
      rotated: gray.rotated,
    },
    color: {
      corners: color.points,
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

  function save(): void {
    error.value = null;
    downloadFile(PROJECT_FILE_NAME, serializeProject(snapshot()), 'application/json');
    notice.value = `Projekt gespeichert als ${PROJECT_FILE_NAME}.`;
  }

  // Übernimmt eine Projektdatei; bei einer fehlerhaften Datei bleibt der bisherige Stand erhalten.
  async function load(text: string): Promise<void> {
    notice.value = null;
    let project: Project;
    try {
      project = parseProject(text);
    } catch (error_) {
      error.value = (error_ as Error).message;
      return;
    }
    error.value = null;
    useCameraStore().discardStills();
    useChartStore().restore({
      points: project.gray.corners,
      measurements: project.gray.measurements,
      rotated: project.gray.rotated,
    });
    useColorChartStore().restore({
      points: project.color.corners,
      measurements: project.color.measurements,
      rotated: project.color.rotated,
    });
    const preview = usePreviewStore();
    preview.setSplit(project.preview.split);

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
    notice.value = missing
      ? `Projekt geladen. Der Referenzsatz „${name}“ ist nicht vorhanden; importiere ihn im Tab „Farbkarten“, um den Bericht zu sehen. Vorschau und Export nutzen das gespeicherte Modell.`
      : 'Projekt geladen.';
  }

  return { error, notice, save, load };
});
