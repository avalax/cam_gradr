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

interface Position {
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

interface Box extends Position {
  width: number;
  height: number;
}

// Up to this multiple of the tolerances (brightness and contrast) a deviation is slight: the shot is
// still good, as the color result of such shots shows.
const SLIGHT_RANGE = 2;

// The part of the field in which brightness and contrast deviate at most this multiple of their
// tolerances from the target.
function rangeBox(factor: number): Box {
  const halfWidth = ((factor * DEFAULT_EXPOSURE_CONFIG.contrastTolerance) / CONTRAST_RANGE) * HALF;
  const halfHeight = ((factor * DEFAULT_EXPOSURE_CONFIG.tolerance) / LIGHT_RANGE) * HALF;
  return {
    left: HALF - halfWidth,
    top: HALF - halfHeight,
    width: 2 * halfWidth,
    height: 2 * halfHeight,
  };
}

// Normal range in the middle of the field, matching the deviations the rating allows (very good), and
// around it the range of slight deviations (good).
export const OK_BOX = rangeBox(1);
export const SLIGHT_BOX = rangeBox(SLIGHT_RANGE);

function percent(value: number): string {
  return t('app.percent', { value: formatDecimal(value * 100, 0) });
}

function signed(value: number): string {
  return t('measure.points', { value: formatSigned(value * 100, 0) });
}

interface DetailRow {
  label: string;
  value: string;
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

// Most important message: its label heads the field, the hint names the next step. `slight` is the
// label for a slight deviation.
interface Issue {
  label: string;
  slight: string;
  hint: string;
}

// The issues are built when needed (not as constants), so they follow the current language.
const tooDark = (): Issue => ({
  label: t('measure.issue.tooDark.label'),
  slight: t('measure.issue.tooDark.slight'),
  hint: t('measure.issue.tooDark.hint'),
});
const tooBright = (): Issue => ({
  label: t('measure.issue.tooBright.label'),
  slight: t('measure.issue.tooBright.slight'),
  hint: t('measure.issue.tooBright.hint'),
});
const lowContrast = (): Issue => ({
  label: t('measure.issue.lowContrast.label'),
  slight: t('measure.issue.lowContrast.slight'),
  hint: t('measure.issue.lowContrast.hint'),
});
const highContrast = (hint = t('measure.issue.highContrast.hint')): Issue => ({
  label: t('measure.issue.highContrast.label'),
  slight: t('measure.issue.highContrast.slight'),
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

// Whether the measurement lies outside the normal range only slightly: nothing clipped and both axes
// within SLIGHT_RANGE times their tolerances.
export function isSlight(exposure: ExposureResult): boolean {
  const { tolerance, contrastTolerance } = DEFAULT_EXPOSURE_CONFIG;
  return (
    !exposure.highlightsClipped &&
    !exposure.shadowsCrushed &&
    Math.abs(exposure.delta) <= SLIGHT_RANGE * tolerance &&
    Math.abs(exposure.contrast) <= SLIGHT_RANGE * contrastTolerance
  );
}

function nextStep(exposure: ExposureResult): Issue | null {
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

// The problem to fix next (null in the normal range or without a measurement); a slight one says so.
export function mainIssue(exposure: ExposureResult | null): Issue | null {
  if (exposure === null) {
    return null;
  }
  const step = nextStep(exposure);
  return step !== null && isSlight(exposure) ? { ...step, label: step.slight } : step;
}

// The line on top of the field, which is also the result in the tab: the problem to fix next, or
// that the exposure is in the normal range.
export function fieldTitle(exposure: ExposureResult | null): string {
  if (exposure === null) {
    return t('app.status.notMeasured');
  }
  return mainIssue(exposure)?.label ?? t('app.status.exposureOk');
}

// Hint in the popup of the field: what to change next about the camera or light.
export function fieldHint(exposure: ExposureResult | null): string {
  if (exposure === null) {
    return t('measure.noMeasurement');
  }
  return mainIssue(exposure)?.hint ?? t('measure.normal');
}
