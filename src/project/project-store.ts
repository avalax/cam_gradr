import { defineStore } from 'pinia';
import { ref, shallowRef } from 'vue';

import { useCameraStore } from '../camera/camera-store';
import type { StillKey, Stills } from '../camera/camera-store';
import { useChartStore, useColorChartStore } from '../chart/chart-store';
import { t } from '../lang';
import type { LookLut } from '../look/look';
import { useLookStore } from '../look/look-store';
import { useExportStore } from '../lut/export-store';
import { LOOK_DEFAULTS, usePreviewStore } from '../lut/preview-store';
import { useReferenceStore } from '../reference/reference-store';
import { useSolveStore } from '../solve/solve-store';

import { decodeFrame, encodeFrame } from './frame-codec';
import { openProjectFile, saveProjectFile } from './project-file';
import type { FileDialogs, ProjectFile } from './project-file';
import { PROJECT_FORMAT, parseProject, serializeProject } from './project';
import type { LookSettings, Project } from './project';
import { decodeLook, encodeLook } from './look-codec';

interface ReadProject {
  project: Project;
  stills: Stills | null;
  luts: LookLut[];
}

// What a project without look LUTs restores: no look, and the defaults of preview and export.
const NO_LOOKS: Omit<LookSettings, 'luts'> = {
  chosen: LOOK_DEFAULTS.look,
  strength: LOOK_DEFAULTS.strength,
  left: LOOK_DEFAULTS.left,
  right: LOOK_DEFAULTS.right,
};

// Checks the file and unpacks its still images and look LUTs before anything in the state changes.
async function readProject(text: string): Promise<ReadProject> {
  const project = parseProject(text);
  return {
    project,
    stills: await decodeStills(project),
    luts: await Promise.all((project.looks?.luts ?? []).map((look) => decodeLook(look))),
  };
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

// Restores corner points, measurements, the preview's divider line and the export size. Corner points
// only apply together with a still image; files without still images bring none.
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
  useExportStore().setSize(project.export.size);
}

// The look LUTs of the file become the whole list, and the preview and the export get their settings
// back; a file without look LUTs loads as if there had never been one. Returns how many look LUTs
// left the browser.
async function applyLooks(
  settings: LookSettings | undefined,
  luts: readonly LookLut[],
): Promise<number> {
  const gone = await useLookStore().replaceAll(luts);
  const { chosen, strength, left, right } = settings ?? NO_LOOKS;
  const preview = usePreviewStore();
  preview.setLook(chosen);
  preview.setStrength(strength);
  preview.setLeft(left);
  preview.setRight(right);
  return gone;
}

// Recomputes the correction with the selected reference set or uses the saved model.
// Returns the name of the reference set if it is missing, otherwise null.
async function applyCorrection(project: Project): Promise<string | null> {
  const references = useReferenceStore();
  await references.load();
  const solve = useSolveStore();
  const name = project.color.reference;
  if (name !== null) {
    references.select(name);
  }
  const reference = references.selected;
  const recompute = reference !== null && reference.name === name;
  if (recompute) {
    // With reference values available, the error report can be recomputed.
    solve.compute({ measurements: project.color.measurements, reference });
  }
  // Otherwise the saved model applies, never one from before, with the name of the set it was
  // fitted with; it also steps in when the calculation fails.
  if (!recompute || (solve.model === null && project.model !== null)) {
    solve.loadModel(project.model, name);
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
// images in the file they are not saved. The reference is the set the correction was fitted with, so
// that a correction loaded without its set keeps naming it; without a correction it is the active
// set, which the measurements are computed with on loading.
function snapshot(withCorners: boolean): Project {
  const gray = useChartStore().committed();
  const color = useColorChartStore().committed();
  const preview = usePreviewStore();
  const solve = useSolveStore();
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
      reference: solve.model === null ? useReferenceStore().selectedName : solve.referenceName,
    },
    model: solve.model,
    preview: { split: preview.split },
    export: { size: useExportStore().size },
  };
}

// All imported look LUTs with their data and what the preview and the export set for them.
async function lookSettings(): Promise<LookSettings> {
  const preview = usePreviewStore();
  return {
    chosen: preview.look,
    strength: preview.strength,
    left: preview.left,
    right: preview.right,
    luts: await Promise.all(useLookStore().looks.map((look) => encodeLook(look))),
  };
}

export const PROJECT_FILE_NAME = 'cam_gradr-project.json';

// Saving and loading the working state as a JSON file (without the manufacturers' reference values).
export const useProjectStore = defineStore('project', () => {
  const error = ref<string | null>(null);
  const notice = ref<string | null>(null);
  // The file that was loaded or saved last: saving suggests it again.
  const file = shallowRef<ProjectFile | null>(null);

  // Saves the working state; with `withStills` the tabs' still images are included in the file.
  async function save(options?: { withStills: boolean; withLooks?: boolean }): Promise<void> {
    error.value = null;
    notice.value = null;
    const withStills = options?.withStills === true;
    const project = snapshot(withStills);
    if (options?.withLooks === true) {
      project.looks = await lookSettings();
    }
    if (withStills) {
      const stills: NonNullable<Project['stills']> = {};
      for (const [key, frame] of Object.entries(useCameraStore().allStills())) {
        stills[key as StillKey] = await encodeFrame(frame);
      }
      project.stills = stills;
    }
    try {
      const saved = await saveProjectFile(serializeProject(project), file.value, PROJECT_FILE_NAME);
      if (saved !== null) {
        file.value = saved;
      }
    } catch (error_) {
      error.value = t('project.errors.saveFailed', { reason: (error_ as Error).message });
    }
  }

  // Applies a project file; with a faulty file the previous state is kept. `source` is the file it
  // came from, which saving suggests afterwards.
  async function load(text: string, source?: ProjectFile): Promise<void> {
    notice.value = null;
    let read: ReadProject;
    try {
      read = await readProject(text);
    } catch (error_) {
      error.value = (error_ as Error).message;
      return;
    }
    error.value = null;
    if (source !== undefined) {
      file.value = source;
    }
    applyStills(read.stills);
    applyCharts(read.project, read.stills !== null);
    const missing = await applyCorrection(read.project);
    const gone = await applyLooks(read.project.looks, read.luts);
    // There are no success messages; a missing reference set and look LUTs that left the browser
    // deserve a notice.
    const notices = [
      missing === null ? null : t('project.notice.missingReference', { name: missing }),
      gone === 0
        ? null
        : t(gone === 1 ? 'project.notice.lookRemoved' : 'project.notice.looksRemoved', {
            count: gone,
          }),
    ].filter((entry) => entry !== null);
    notice.value = notices.length === 0 ? null : notices.join(' ');
  }

  // Lets the user choose a project file in the system dialog and loads it.
  async function open(dialogs: FileDialogs): Promise<void> {
    try {
      const picked = await openProjectFile(dialogs);
      if (picked !== null) {
        await load(picked.text, picked.file);
      }
    } catch (error_) {
      error.value = t('project.errors.openFailed', { reason: (error_ as Error).message });
    }
  }

  // Dismisses the message.
  function dismiss(): void {
    error.value = null;
    notice.value = null;
  }

  return { error, notice, save, load, open, dismiss };
});
