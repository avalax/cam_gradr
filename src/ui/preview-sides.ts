import { t } from '../lang';
import type { Side } from '../lut/preview-store';

// What the two sides of the preview show and how they are named. Without a look LUT the sides are
// fixed: the camera image on the left, the correction on the right. With a look the left side shows
// the camera image or the correction, and the right side lays the look over the correction or over
// the camera image. The labels above the preview and the hint of its tab use the same names; only the
// labels add the strength of the look.
interface PreviewSides {
  leftCorrected: boolean;
  rightCamera: boolean;
  leftName: string;
  rightName: string;
}

export function previewSides(look: boolean, left: Side, right: Side): PreviewSides {
  const leftCorrected = look && left === 'corrected';
  const rightCamera = look && right === 'camera';
  let rightKey = 'preview.labelCorrected';
  if (look) {
    rightKey = rightCamera ? 'preview.labelLookCamera' : 'preview.labelLook';
  }
  return {
    leftCorrected,
    rightCamera,
    leftName: t(leftCorrected ? 'preview.labelCorrected' : 'preview.labelCamera'),
    rightName: t(rightKey),
  };
}
