import { t } from '../lang';
import type { Side } from '../lut/preview-store';

// What the two sides of the preview show and how they are named. Without a look LUT the sides are
// fixed: the camera image on the left, the correction on the right. With a look the left side shows
// the camera image or the correction, and the right side lays the look over the correction or over
// the camera image. The image without correction is named "camera" while the camera runs and "still
// image" while the preview shows a still image. The labels above the preview and the hint of its tab
// use the same names; only the labels add the strength of the look.
interface PreviewSides {
  leftCorrected: boolean;
  rightCamera: boolean;
  leftName: string;
  rightName: string;
}

export function previewSides(look: boolean, left: Side, right: Side, still: boolean): PreviewSides {
  const leftCorrected = look && left === 'corrected';
  const rightCamera = look && right === 'camera';
  const plain = still ? 'preview.labelStill' : 'preview.labelCamera';
  const lookPlain = still ? 'preview.labelLookStill' : 'preview.labelLookCamera';
  let rightKey = 'preview.labelCorrected';
  if (look) {
    rightKey = rightCamera ? lookPlain : 'preview.labelLook';
  }
  return {
    leftCorrected,
    rightCamera,
    leftName: t(leftCorrected ? 'preview.labelCorrected' : plain),
    rightName: t(rightKey),
  };
}
