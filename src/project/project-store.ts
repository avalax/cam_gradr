import { defineStore } from 'pinia';
import { ref } from 'vue';

import { useCameraStore } from '../camera/camera-store';
import type { StillKey, Stills } from '../camera/camera-store';
import { useChartStore, useColorChartStore } from '../chart/chart-store';
import { NEUTRAL_IDS } from '../chart/layouts';
import { t } from '../lang';
import { downloadFile } from '../lut/download';
import { usePreviewStore } from '../lut/preview-store';
import { useReferenceStore } from '../reference/reference-store';
import { useSolveStore } from '../solve/solve-store';

import { decodeFrame, encodeFrame } from './frame-codec';
import { PROJECT_FORMAT, parseProject, serializeProject } from './project';
import type { Project } from './project';

// Checks the file and unpacks its still images before anything in the state changes.
async function readProject(text: string): Promise<{ project: Project; stills: Stills | null }> {
  const project = parseProject(text);
  return { project, stills: await decodeStills(project) };
}

// Replaces the still images; with saved images the live image is no longer needed.
function applyStills(stills: Stills | null): void {
  const camera = useCameraStore();
  camera.discardStills();
  if (stills !== null) {
    camera.stop();
    camera.restoreStills(stills);
  }
}

// Restores corner points, measurements and the preview's divider line. Corner points only apply together
// with a still image; files without still images (including older ones) bring none.
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

// Recomputes the correction with the selected reference set or uses the saved model.
// Returns the name of the reference set if it is missing, otherwise null.
async function applyCorrection(project: Project): Promise<string | null> {
  const references = useReferenceStore();
  await references.load();
  const solve = useSolveStore();
  solve.setTone(project.tone);
  const name = project.color.reference;
  if (name !== null) {
    references.select(name);
  }
  const reference = references.selected;
  if (reference !== null && reference.name === name) {
    // With reference values available, the error report can be recomputed.
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

// Unpacks the still images of a project file (null if the file has none).
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

// Reads the current working state from the stores. Corner points belong to a still image: without still
// images in the file they are not saved.
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
    tone: useSolveStore().tone,
    preview: { split: preview.split },
  };
}

export const PROJECT_FILE_NAME = 'cam_gradr-project.json';

// Saving and loading the working state as a JSON file (without the manufacturers' reference values).
export const useProjectStore = defineStore('project', () => {
  const error = ref<string | null>(null);
  const notice = ref<string | null>(null);

  // Saves the working state; with `withStills` the tabs' still images are included in the file.
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

  // Applies a project file; with a faulty file the previous state is kept.
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
    // There are no success messages; only a missing reference set deserves a notice.
    notice.value =
      missing === null ? null : t('project.notice.missingReference', { name: missing });
  }

  // Dismisses the message.
  function dismiss(): void {
    error.value = null;
    notice.value = null;
  }

  return { error, notice, save, load, dismiss };
});
