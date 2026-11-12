import { codeLuma } from '../chart/exposure';
import { NEUTRAL_IDS, colorLayout } from '../chart/layouts';
import type { Measurements } from '../chart/measure';
import { labToSrgb } from '../color/lab';
import type { ReferenceSet } from '../reference/reference';
import { applyColorModel, targetLab } from '../solve/fit';
import type { ColorModel, FitResult } from '../solve/fit';
import { t } from '../lang';
import type { messages } from '../lang';
import { formatDecimal, formatSigned } from '../lang/format';

import { cssColor } from './color-css';

// A neutral patch in the gray wedge: target color (if there is a reference set), camera color and
// color after the correction.
export interface WedgeRow {
  id: string;
  target: string | null;
  camera: string;
  corrected: string;
}

// The target is shown as the report measures it (targetLab with `exposureGain` from the fit report):
// at the exposure of the shot, as the correction keeps that exposure, and within the sRGB gamut.
function patchRow(
  id: string,
  measurements: Measurements,
  model: ColorModel,
  reference: ReferenceSet | null,
  exposureGain: number,
): WedgeRow | null {
  const measured = measurements[id];
  if (measured === undefined) {
    return null;
  }
  const lab = reference?.patches[id];
  return {
    id,
    target: lab === undefined ? null : cssColor(labToSrgb(targetLab(lab, exposureGain))),
    camera: cssColor(measured),
    corrected: cssColor(applyColorModel(model, measured)),
  };
}

// The measured neutral patches of the color cards from light to dark (by camera value). Without
// a correction model there is no gray wedge.
export function wedgeRows(
  measurements: Measurements,
  model: ColorModel | null,
  reference: ReferenceSet | null,
  exposureGain: number,
): WedgeRow[] {
  if (model === null) {
    return [];
  }
  const rows: { luma: number; row: WedgeRow }[] = [];
  for (const id of NEUTRAL_IDS) {
    const row = patchRow(id, measurements, model, reference, exposureGain);
    const measured = measurements[id];
    if (row !== null && measured !== undefined) {
      rows.push({ luma: codeLuma(measured), row });
    }
  }
  return rows.toSorted((first, second) => second.luma - first.luma).map(({ row }) => row);
}

// Patch IDs like "3F" (row 3, column F): sorted row by row from A to H on the card.
export function byRowThenColumn(a: string, b: string): number {
  return Number(a.slice(0, -1)) - Number(b.slice(0, -1)) || a.slice(-1).localeCompare(b.slice(-1));
}

// The chromatic patches per card in card order; only measured patches, without a correction model
// nothing. Cards without measured chromatic patches are missing.
export function colorCards(
  measurements: Measurements,
  model: ColorModel | null,
  reference: ReferenceSet | null,
  exposureGain: number,
): WedgeRow[][] {
  if (model === null) {
    return [];
  }
  return colorLayout.cards
    .map((card) =>
      card.patches
        .map((patch) => patch.id)
        .filter((id) => !NEUTRAL_IDS.has(id))
        .toSorted(byRowThenColumn)
        .map((id) => patchRow(id, measurements, model, reference, exposureGain))
        .filter((row) => row !== null),
    )
    .filter((rows) => rows.length > 0);
}

interface WorstPatch {
  id: string;
  deviation: number;
}

// The preview names the three of them.
const WORST_COUNT = 3;

// The chromatic patches with the largest residual error after the correction.
export function worstPatches(report: FitResult['report']): WorstPatch[] {
  return report.patches
    .filter((patch) => !patch.neutral)
    .toSorted((first, second) => second.after - first.after)
    .slice(0, WORST_COUNT)
    .map((patch) => ({ id: patch.id, deviation: patch.after }));
}

// The names of the columns and zones in the language files. The typed `t` takes any string as a
// key, so these unions make a column or a zone without a text fail the typecheck.
type Wedge = (typeof messages)['en']['wedge'];
type Column = keyof Wedge['columns'];
type Zone = keyof Wedge['zones'];

// The table of the tonal ranges: how much lighter or darker, then the three channels.
const COLUMNS = ['brightness', 'red', 'green', 'blue'] as const satisfies readonly Column[];

// Each column with a short name for its head and its full name for screen readers.
export function zoneColumns(): { key: Column; short: string; name: string }[] {
  return COLUMNS.map((key) => ({
    key,
    short: t(`wedge.columns.${key}.short`),
    name: t(`wedge.columns.${key}.name`),
  }));
}

// Tonal ranges of the gray wedge (camera value from 0 to 1) and the resolution of the analysis.
const ZONES = [
  { key: 'shadows', from: 0.1, to: 0.3 },
  { key: 'midtones', from: 0.4, to: 0.6 },
  { key: 'highlights', from: 0.7, to: 0.9 },
] as const satisfies readonly { key: Zone; from: number; to: number }[];

function zoneName(key: Zone): string {
  return t(`wedge.zones.${key}`);
}
const STEPS = 32;
const PERCENT = 100;

interface ZoneChange {
  name: string;
  // In the order of the columns, in points: the mean brightening (negative = darkened), then the
  // shift of each channel relative to the other two (positive = stronger).
  values: number[];
}

// What the correction changes at a neutral gray per tonal range: how much lighter or darker and
// which color channels get stronger or weaker.
export function zoneChanges(model: ColorModel): ZoneChange[] {
  return ZONES.map(({ key, from, to }) => {
    const samples = Array.from({ length: STEPS + 1 }, (_, index) => index / STEPS)
      .filter((value) => value >= from && value <= to)
      .map((value) => ({ value, out: applyColorModel(model, [value, value, value]) }));
    const deltas = [0, 1, 2].map(
      (channel) =>
        (samples.reduce((sum, { value, out }) => sum + Number(out[channel]) - value, 0) /
          samples.length) *
        PERCENT,
    );
    const brighter = deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length;
    return { name: zoneName(key), values: [brighter, ...deltas.map((delta) => delta - brighter)] };
  });
}

// Whole points with a sign; no change is a plain 0.
export function zonePoints(value: number): string {
  const points = Math.round(value);
  return points === 0 ? '0' : formatSigned(points);
}

// Mean error before and after the correction as a label, e.g. "Ø deviation 18.4 → 8.0".
export function deviationSummary(report: { meanBefore: number; meanAfter: number }): string {
  return t('wedge.deviationSummary', {
    before: formatDecimal(report.meanBefore),
    after: formatDecimal(report.meanAfter),
  });
}
