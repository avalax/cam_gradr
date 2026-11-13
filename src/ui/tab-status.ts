import type { ExposureResult } from '../chart/exposure';
import { t } from '../lang';
import { formatDecimal } from '../lang/format';

import { fieldTitle, isSlight } from './measure-field';

export type StatusLevel = 'off' | 'bad' | 'warn' | 'ok';

// Status of a tab: level, fill of the mini scale (0 to 4 bars), a short result text and the rating in
// words (for screen readers, which do not see the scale; null without a result).
export interface TabStatus {
  level: StatusLevel;
  fill: number;
  text: string;
  rating: string | null;
}

// Mean error (ΔE2000) after the correction: the limits of four, three and two bars (very good, good,
// fair; above that poor). Very good ends at 3, about the best a shot reaches with the bundled
// reference set: the rest is the uncertainty of the reference values and of the light.
const COLOR_VERY_GOOD = 3;
const COLOR_GOOD = 4;
const COLOR_FAIR = 6;

const FILL_VERY_GOOD = 4;
const FILL_GOOD = 3;
const FILL_FAIR = 2;
const FILL_POOR = 1;

type Fill = typeof FILL_VERY_GOOD | typeof FILL_GOOD | typeof FILL_FAIR | typeof FILL_POOR;

// The color of the scale follows its bars (three or four are good, two a hint, one a problem), with
// the rating in words.
const GRADES: Readonly<Record<Fill, { level: StatusLevel; rating: string }>> = {
  [FILL_VERY_GOOD]: { level: 'ok', rating: 'app.rating.veryGood' },
  [FILL_GOOD]: { level: 'ok', rating: 'app.rating.good' },
  [FILL_FAIR]: { level: 'warn', rating: 'app.rating.fair' },
  [FILL_POOR]: { level: 'bad', rating: 'app.rating.poor' },
};

function rated(fill: Fill, text: string): TabStatus {
  const { level, rating } = GRADES[fill];
  return { level, fill, text, rating: t(rating) };
}

// Bars of a gray card result: the normal range is very good, a slight deviation good, clipped
// highlights or crushed shadows the worst case.
function grayFill(exposure: ExposureResult): Fill {
  if (exposure.verdict === 'ok') {
    return FILL_VERY_GOOD;
  }
  if (exposure.highlightsClipped || exposure.shadowsCrushed) {
    return FILL_POOR;
  }
  return isSlight(exposure) ? FILL_GOOD : FILL_FAIR;
}

// Bars of the color result, from the mean error after the correction.
function colorFill(meanAfter: number): Fill {
  if (meanAfter <= COLOR_VERY_GOOD) {
    return FILL_VERY_GOOD;
  }
  if (meanAfter <= COLOR_GOOD) {
    return FILL_GOOD;
  }
  return meanAfter <= COLOR_FAIR ? FILL_FAIR : FILL_POOR;
}

// Gray cards: the line on top of the measuring field.
export function grayStatus(exposure: ExposureResult | null): TabStatus {
  if (exposure === null) {
    return { level: 'off', fill: 0, text: fieldTitle(null), rating: null };
  }
  return rated(grayFill(exposure), fieldTitle(exposure));
}

// Color cards: the status follows the mean error after the correction, not mere computation. A
// correction without a report (loaded from a project whose reference set is missing) says so instead
// of looking as if nothing were calculated.
export function colorStatus(
  report: { meanBefore: number; meanAfter: number } | null,
  corrected: boolean,
): TabStatus {
  if (report === null) {
    return {
      level: 'off',
      fill: 0,
      text: t(corrected ? 'app.status.noReport' : 'app.status.notComputed'),
      rating: null,
    };
  }
  const text = t('app.status.meanChange', {
    before: formatDecimal(report.meanBefore),
    after: formatDecimal(report.meanAfter),
  });
  return rated(colorFill(report.meanAfter), text);
}
