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

// Mean error (ΔE2000) after the correction: good up to here, a hint up to the second limit,
// clearly too high above that.
const COLOR_GOOD = 2;
const COLOR_FAIR = 5;

const FILL_OK = 4;
const FILL_FAIR = 3;
const FILL_POOR = 2;

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
    fill: FILL_POOR,
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
  if (report.meanAfter <= COLOR_GOOD) {
    return { level: 'ok', fill: FILL_OK, text };
  }
  return { level: 'warn', fill: report.meanAfter <= COLOR_FAIR ? FILL_FAIR : FILL_POOR, text };
}
