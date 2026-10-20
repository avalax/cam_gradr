import { DEFAULT_EXPOSURE_CONFIG } from '../chart/exposure';
import type { ExposureResult } from '../chart/exposure';
import { t } from '../lang';

import { oneDecimal } from './gray-wedge';
import { mainIssue } from './measure-field';

export type StatusLevel = 'off' | 'warn' | 'ok';

// Status of a tab: level, fill of the mini scale (0 to 4 bars) and a short result text.
export interface TabStatus {
  level: StatusLevel;
  fill: number;
  text: string;
}

// Mean error (ΔE2000) after the correction: the limits of the four bars (good, fair, poor, else bad).
const COLOR_GOOD = 2;
const COLOR_FAIR = 4;
const COLOR_POOR = 7;

// Gray cards: a deviation of the large patches up to this multiple of the tolerance still counts as
// slightly off.
const SLIGHT_DEVIATION = 2;

const FILL_OK = 4;
const FILL_FAIR = 3;
const FILL_POOR = 2;
const FILL_BAD = 1;

// Bars of a gray card result that is not in the normal range: clipped highlights or crushed shadows
// are the worst case, otherwise the distance of the brightness to the target decides.
function grayFill(exposure: ExposureResult): number {
  if (exposure.highlightsClipped || exposure.shadowsCrushed) {
    return FILL_BAD;
  }
  return Math.abs(exposure.delta) <= SLIGHT_DEVIATION * DEFAULT_EXPOSURE_CONFIG.tolerance
    ? FILL_FAIR
    : FILL_POOR;
}

// Bars of the color result, from the mean error after the correction.
function colorFill(meanAfter: number): number {
  if (meanAfter <= COLOR_GOOD) {
    return FILL_OK;
  }
  if (meanAfter <= COLOR_FAIR) {
    return FILL_FAIR;
  }
  return meanAfter <= COLOR_POOR ? FILL_POOR : FILL_BAD;
}

// Gray cards: green only if the measuring point is in the normal range; otherwise the most important hint.
export function grayStatus(exposure: ExposureResult | null): TabStatus {
  if (exposure === null) {
    return { level: 'off', fill: 0, text: t('app.status.notMeasured') };
  }
  if (exposure.verdict === 'ok') {
    return { level: 'ok', fill: FILL_OK, text: t('app.status.lightOk') };
  }
  return {
    level: 'warn',
    fill: grayFill(exposure),
    text: mainIssue(exposure)?.label ?? t('app.status.checkLight'),
  };
}

// Color cards: the status follows the mean error after the correction, not mere computation.
export function colorStatus(report: { meanBefore: number; meanAfter: number } | null): TabStatus {
  if (report === null) {
    return { level: 'off', fill: 0, text: t('app.status.notComputed') };
  }
  const text = t('app.status.meanChange', {
    before: oneDecimal(report.meanBefore),
    after: oneDecimal(report.meanAfter),
  });
  const fill = colorFill(report.meanAfter);
  return { level: report.meanAfter <= COLOR_GOOD ? 'ok' : 'warn', fill, text };
}
