import { DEFAULT_EXPOSURE_CONFIG } from '../chart/exposure';
import type { ExposureResult } from '../chart/exposure';
import { t } from '../lang';
import { formatDecimal, formatSigned } from '../lang/format';

// Deviation (as a fraction of brightness) that gives the full deflection of the measuring field.
const LIGHT_RANGE = 0.3;
const CONTRAST_RANGE = 0.25;
const HALF = 50;

// A measurement that would come closer to the edge than this share of half the field makes the field
// zoom out: it then shows twice, four or eight times the range, so that the dot stays in the field
// and the courts shrink with it. A measurement close to the target keeps the normal range.
const KEEP = 0.85;
const ZOOM_STEPS = [1, 2, 4, 8];
const MAX_ZOOM = 8;

function clamp(value: number): number {
  return Math.min(Math.max(value, 0), 100);
}

function fieldZoom(exposure: ExposureResult | null): number {
  if (exposure === null) {
    return 1;
  }
  const reach = Math.max(
    Math.abs(exposure.contrast) / CONTRAST_RANGE,
    Math.abs(exposure.delta) / LIGHT_RANGE,
  );
  return ZOOM_STEPS.find((step) => reach <= KEEP * step) ?? MAX_ZOOM;
}

interface Position {
  left: number;
  top: number;
}

// Position of the measurement in the field in percent: horizontal is contrast (right = too high),
// vertical is brightness (top = too high).
export function fieldPosition(exposure: ExposureResult): Position {
  const zoom = fieldZoom(exposure);
  return {
    left: clamp(HALF + (exposure.contrast / (CONTRAST_RANGE * zoom)) * HALF),
    top: clamp(HALF - (exposure.delta / (LIGHT_RANGE * zoom)) * HALF),
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
function rangeBox(factor: number, zoom: number): Box {
  const { contrastTolerance, tolerance } = DEFAULT_EXPOSURE_CONFIG;
  const halfWidth = ((factor * contrastTolerance) / (CONTRAST_RANGE * zoom)) * HALF;
  const halfHeight = ((factor * tolerance) / (LIGHT_RANGE * zoom)) * HALF;
  return {
    left: HALF - halfWidth,
    top: HALF - halfHeight,
    width: 2 * halfWidth,
    height: 2 * halfHeight,
  };
}

// Normal range in the middle of the field, matching the deviations the rating allows (very good), and
// around it the range of slight deviations (good), at the zoom the measurement needs.
export function fieldRanges(exposure: ExposureResult | null): { ok: Box; slight: Box } {
  const zoom = fieldZoom(exposure);
  return { ok: rangeBox(1, zoom), slight: rangeBox(SLIGHT_RANGE, zoom) };
}

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
// patch and the large patches, then contrast. An end of the strip that is cut off (black shadows or
// white highlights) is a matter of brightness while the large patches are too dark or too bright
// towards it, otherwise of contrast.
function brightnessStep(exposure: ExposureResult): Issue | null {
  const { tolerance } = DEFAULT_EXPOSURE_CONFIG;
  if (exposure.shadowsCrushed && exposure.highlightsClipped) {
    return highContrast(t('measure.issue.bothClipped'));
  }
  if (exposure.shadowsCrushed) {
    return exposure.delta < -tolerance ? tooDark() : highContrast();
  }
  if (exposure.highlightsClipped) {
    return exposure.delta > tolerance ? tooBright() : highContrast();
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
