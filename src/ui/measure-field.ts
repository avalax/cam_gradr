import { DEFAULT_EXPOSURE_CONFIG } from '../chart/exposure';
import type { ExposureResult } from '../chart/exposure';
import { t } from '../lang';
import { formatDecimal, formatSigned } from '../lang/format';

// Deviation (as a fraction of brightness) that gives the full deflection of the measuring field.
const LIGHT_RANGE = 0.3;
const CONTRAST_RANGE = 0.25;
const HALF = 50;

function clamp(value: number): number {
  return Math.min(Math.max(value, 0), 100);
}

export interface Position {
  left: number;
  top: number;
}

// Position of the measurement in the field in percent: horizontal is contrast (right = too high),
// vertical is brightness (top = too high).
export function fieldPosition(exposure: ExposureResult): Position {
  return {
    left: clamp(HALF + (exposure.contrast / CONTRAST_RANGE) * HALF),
    top: clamp(HALF - (exposure.delta / LIGHT_RANGE) * HALF),
  };
}

export interface Box extends Position {
  width: number;
  height: number;
}

// Normal range in the middle of the field, matching the allowed deviations.
export function okBox(
  lightTolerance = DEFAULT_EXPOSURE_CONFIG.tolerance,
  contrastTolerance = DEFAULT_EXPOSURE_CONFIG.contrastTolerance,
): Box {
  const halfWidth = (contrastTolerance / CONTRAST_RANGE) * HALF;
  const halfHeight = (lightTolerance / LIGHT_RANGE) * HALF;
  const left = clamp(HALF - halfWidth);
  const top = clamp(HALF - halfHeight);
  return {
    left,
    top,
    width: clamp(HALF + halfWidth) - left,
    height: clamp(HALF + halfHeight) - top,
  };
}

function percent(value: number): string {
  return t('measure.percent', { value: formatDecimal(value * 100, 0) });
}

function signed(value: number): string {
  return t('measure.points', { value: formatSigned(value * 100, 0) });
}

export interface DetailRow {
  label: string;
  value: string;
}

// Heading of the measured values in the popup: the percentages are brightness values in the camera
// image.
export function detailCaption(): string {
  return t('measure.caption');
}

function withTolerance(value: number, tolerance: number): string {
  return t('measure.withTolerance', {
    value: signed(value),
    tolerance: t('measure.tolerance', { value: formatDecimal(tolerance * 100, 0) }),
  });
}

function withTarget(level: number, target: number): string {
  return t('measure.target', { level: percent(level), target: percent(target) });
}

export function detailRows(exposure: ExposureResult): DetailRow[] {
  const { target18, target50, tolerance, contrastTolerance } = DEFAULT_EXPOSURE_CONFIG;
  return [
    { label: t('measure.rows.card18'), value: withTarget(exposure.level18, target18) },
    { label: t('measure.rows.card50'), value: withTarget(exposure.level50, target50) },
    { label: t('measure.rows.brightness'), value: withTolerance(exposure.delta, tolerance) },
    {
      label: t('measure.rows.contrast'),
      value: withTolerance(exposure.contrast, contrastTolerance),
    },
    {
      label: t('measure.rows.highlights'),
      value: t(exposure.highlightsClipped ? 'measure.rows.overexposed' : 'measure.rows.ok'),
    },
    {
      label: t('measure.rows.shadows'),
      value: t(exposure.shadowsCrushed ? 'measure.rows.underexposed' : 'measure.rows.ok'),
    },
  ];
}

export type Edge = 'top' | 'bottom' | 'left' | 'right';

// Most important message: it sits on the edge of the field towards which the measurement deviates,
// and names the next step together with the hint.
export interface Issue {
  edge: Edge;
  label: string;
  hint: string;
}

// The issues are built when needed (not as constants), so they follow the current language.
const tooDark = (): Issue => ({
  edge: 'bottom',
  label: t('measure.issue.tooDark.label'),
  hint: t('measure.issue.tooDark.hint'),
});
const tooBright = (): Issue => ({
  edge: 'top',
  label: t('measure.issue.tooBright.label'),
  hint: t('measure.issue.tooBright.hint'),
});
const lowContrast = (): Issue => ({
  edge: 'left',
  label: t('measure.issue.lowContrast.label'),
  hint: t('measure.issue.lowContrast.hint'),
});
const highContrast = (hint = t('measure.issue.highContrast.hint')): Issue => ({
  edge: 'right',
  label: t('measure.issue.highContrast.label'),
  hint,
});

// Brightness and contrast influence each other (more contrast pushes the shadows down on most
// cameras again). So there is only ever one step: brightness first, judged by the darkest strip
// patch and the large patches, then contrast.
function brightnessStep(exposure: ExposureResult): Issue | null {
  const { tolerance } = DEFAULT_EXPOSURE_CONFIG;
  if (exposure.shadowsCrushed && exposure.highlightsClipped) {
    return highContrast(t('measure.issue.bothClipped'));
  }
  if (exposure.shadowsCrushed) {
    return { ...tooDark(), hint: t('measure.issue.shadowsCrushed') };
  }
  if (exposure.highlightsClipped) {
    return exposure.delta > tolerance
      ? { ...tooBright(), hint: t('measure.issue.highlightsBright') }
      : highContrast(t('measure.issue.highlightsContrast'));
  }
  if (exposure.delta < -tolerance) {
    return tooDark();
  }
  return exposure.delta > tolerance ? tooBright() : null;
}

// The problem to fix next (null in the normal range or without a measurement).
export function mainIssue(exposure: ExposureResult | null): Issue | null {
  if (exposure === null) {
    return null;
  }
  const { contrastTolerance } = DEFAULT_EXPOSURE_CONFIG;
  const step = brightnessStep(exposure);
  if (step !== null) {
    return step;
  }
  if (exposure.contrast < -contrastTolerance) {
    return lowContrast();
  }
  return exposure.contrast > contrastTolerance ? highContrast() : null;
}

// Short hint below the field: what to change next about the camera or light.
export function fieldHint(exposure: ExposureResult | null): string {
  if (exposure === null) {
    return t('measure.noMeasurement');
  }
  return mainIssue(exposure)?.hint ?? t('measure.normal');
}
