import { codeLuma } from '../chart/exposure';
import type { Measurements } from '../chart/measure';
import type { ChartLayout } from '../chart/types';
import { labToSrgb } from '../color/lab';
import type { ReferenceSet } from '../reference/reference';
import { applyColorModel } from '../solve/fit';
import type { ColorModel, FitResult } from '../solve/fit';
import { t } from '../lang';
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

function patchRow(
  id: string,
  measurements: Measurements,
  model: ColorModel,
  reference: ReferenceSet | null,
): WedgeRow | null {
  const measured = measurements[id];
  if (measured === undefined) {
    return null;
  }
  const lab = reference?.patches[id];
  return {
    id,
    target: lab === undefined ? null : cssColor(labToSrgb(lab)),
    camera: cssColor(measured),
    corrected: cssColor(applyColorModel(model, measured)),
  };
}

// The measured neutral patches of the color cards from light to dark (by camera value). Without
// Korrekturmodell gibt es keinen Graukeil.
export function wedgeRows(
  neutralIds: ReadonlySet<string>,
  measurements: Measurements,
  model: ColorModel | null,
  reference: ReferenceSet | null,
): WedgeRow[] {
  if (model === null) {
    return [];
  }
  const rows: { luma: number; row: WedgeRow }[] = [];
  for (const id of neutralIds) {
    const row = patchRow(id, measurements, model, reference);
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
  layout: ChartLayout,
  neutralIds: ReadonlySet<string>,
  measurements: Measurements,
  model: ColorModel | null,
  reference: ReferenceSet | null,
): WedgeRow[][] {
  if (model === null) {
    return [];
  }
  return layout.cards
    .map((card) =>
      card.patches
        .map((patch) => patch.id)
        .filter((id) => !neutralIds.has(id))
        .toSorted(byRowThenColumn)
        .map((id) => patchRow(id, measurements, model, reference))
        .filter((row) => row !== null),
    )
    .filter((rows) => rows.length > 0);
}

export interface WorstPatch {
  id: string;
  deviation: number;
}

// The chromatic patches with the largest residual error after the correction.
export function worstPatches(report: FitResult['report'], count: number): WorstPatch[] {
  return report.patches
    .filter((patch) => !patch.neutral)
    .toSorted((first, second) => second.after - first.after)
    .slice(0, count)
    .map((patch) => ({ id: patch.id, deviation: patch.after }));
}

const CHANNELS = ['red', 'green', 'blue'] as const;
type Channel = (typeof CHANNELS)[number];

function channelName(channel: Channel): string {
  return {
    red: t('wedge.channels.red'),
    green: t('wedge.channels.green'),
    blue: t('wedge.channels.blue'),
  }[channel];
}

// Tonal ranges of the gray wedge (camera value from 0 to 1) and the resolution of the analysis.
const ZONES = [
  { key: 'shadows', from: 0.1, to: 0.3 },
  { key: 'midtones', from: 0.4, to: 0.6 },
  { key: 'highlights', from: 0.7, to: 0.9 },
] as const;

function zoneName(key: (typeof ZONES)[number]['key']): string {
  return {
    shadows: t('wedge.zones.shadows'),
    midtones: t('wedge.zones.midtones'),
    highlights: t('wedge.zones.highlights'),
  }[key];
}
const STEPS = 32;
const PERCENT = 100;
// Shifts below this value (in points) count as no change.
const MIN_POINTS = 1.5;

interface CastChange {
  // Which channel it is (stable, for colors) and its name in the current language.
  key: Channel;
  channel: string;
  // Shift of the channel relative to the other two, in points (positive = stronger).
  points: number;
}

export interface ZoneChange {
  name: string;
  // Mittlere Aufhellung (negativ = abgedunkelt) in Punkten.
  brighter: number;
  casts: CastChange[];
}

// What the correction changes at a neutral gray per tonal range: how much lighter or darker and
// which color channels get stronger or weaker.
export function zoneChanges(model: ColorModel): ZoneChange[] {
  return ZONES.map(({ key, from, to }) => {
    const samples = Array.from({ length: STEPS + 1 }, (_, index) => index / STEPS)
      .filter((value) => value >= from && value <= to)
      .map((value) => ({ value, out: applyColorModel(model, [value, value, value]) }));
    const deltas = CHANNELS.map(
      (_, channel) =>
        (samples.reduce((sum, { value, out }) => sum + Number(out[channel]) - value, 0) /
          samples.length) *
        PERCENT,
    );
    const brighter = deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length;
    const casts = CHANNELS.map((channel, index) => ({
      key: channel,
      channel: channelName(channel),
      points: Number(deltas[index]) - brighter,
    }))
      .filter((cast) => Math.abs(cast.points) >= MIN_POINTS)
      .toSorted((a, b) => Math.abs(b.points) - Math.abs(a.points));
    return { name: zoneName(key), brighter, casts };
  });
}

export function signedPoints(value: number): string {
  return formatSigned(Math.round(value));
}

// "13 heller", "5 dunkler" or "gleich hell" for the mean brightening.
export function brightnessText(brighter: number): string {
  const points = Math.abs(Math.round(brighter));
  if (points === 0) {
    return t('wedge.brightness.same');
  }
  return t(brighter > 0 ? 'wedge.brightness.brighter' : 'wedge.brightness.darker', { points });
}

export function oneDecimal(value: number): string {
  return formatDecimal(value, 1);
}

// Mean error before and after the correction as a label, e.g. "Ø Abweichung 18,4 → 8,0".
export function deviationSummary(report: { meanBefore: number; meanAfter: number }): string {
  return t('wedge.deviationSummary', {
    before: oneDecimal(report.meanBefore),
    after: oneDecimal(report.meanAfter),
  });
}
