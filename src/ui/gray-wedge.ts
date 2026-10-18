import { codeLuma } from '../chart/exposure';
import type { Measurements } from '../chart/measure';
import type { ChartLayout } from '../chart/types';
import { labToSrgb } from '../color/lab';
import type { ReferenceSet } from '../reference/reference';
import { applyColorModel } from '../solve/fit';
import type { ColorModel, FitResult } from '../solve/fit';

import { cssColor } from './color-css';

// Ein Neutralfeld im Graukeil: Sollfarbe (falls es einen Referenzsatz gibt), Farbe der Kamera und
// Farbe nach der Korrektur.
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

// Die gemessenen Neutralfelder der Farbkarten von hell nach dunkel (nach dem Wert der Kamera). Ohne
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

// Feld-IDs wie "3F" (Zeile 3, Spalte F): auf der Karte zeilenweise von A nach H sortiert.
export function byRowThenColumn(a: string, b: string): number {
  return Number(a.slice(0, -1)) - Number(b.slice(0, -1)) || a.slice(-1).localeCompare(b.slice(-1));
}

// Die bunten Felder je Karte in der Reihenfolge auf der Karte; nur gemessene Felder, ohne Korrekturmodell
// nichts. Karten ohne gemessene bunte Felder fehlen.
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

// Die bunten Felder mit der größten Rest-Abweichung nach der Korrektur.
export function worstPatches(report: FitResult['report'], count: number): WorstPatch[] {
  return report.patches
    .filter((patch) => !patch.neutral)
    .toSorted((first, second) => second.after - first.after)
    .slice(0, count)
    .map((patch) => ({ id: patch.id, deviation: patch.after }));
}

const CHANNELS = ['Rot', 'Grün', 'Blau'] as const;
type Channel = (typeof CHANNELS)[number];

// Tonbereiche des Graukeils (Wert der Kamera von 0 bis 1) und die Auflösung der Auswertung.
const ZONES = [
  { name: 'Schatten', from: 0.1, to: 0.3 },
  { name: 'Mitten', from: 0.4, to: 0.6 },
  { name: 'Lichter', from: 0.7, to: 0.9 },
] as const;
const STEPS = 32;
const PERCENT = 100;
// Verschiebungen unter diesem Wert (in Punkten) gelten als keine Änderung.
const MIN_POINTS = 1.5;

interface CastChange {
  channel: Channel;
  // Verschiebung des Kanals gegenüber den anderen beiden, in Punkten (positiv = stärker).
  points: number;
}

export interface ZoneChange {
  name: string;
  // Mittlere Aufhellung (negativ = abgedunkelt) in Punkten.
  brighter: number;
  casts: CastChange[];
}

// Was die Korrektur je Tonbereich an einem neutralen Grau ändert: wie viel heller oder dunkler und
// welche Farbkanäle stärker oder schwächer werden.
export function zoneChanges(model: ColorModel): ZoneChange[] {
  return ZONES.map(({ name, from, to }) => {
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
      channel,
      points: Number(deltas[index]) - brighter,
    }))
      .filter((cast) => Math.abs(cast.points) >= MIN_POINTS)
      .toSorted((a, b) => Math.abs(b.points) - Math.abs(a.points));
    return { name, brighter, casts };
  });
}

export function signedPoints(value: number): string {
  return `${value >= 0 ? '+' : '−'}${String(Math.abs(Math.round(value)))}`;
}

// "13 heller", "5 dunkler" oder "gleich hell" für die mittlere Aufhellung.
export function brightnessText(brighter: number): string {
  const points = Math.abs(Math.round(brighter));
  if (points === 0) {
    return 'gleich hell';
  }
  return `${String(points)} ${brighter > 0 ? 'heller' : 'dunkler'}`;
}

export function oneDecimal(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

// Mittlere Abweichung vor und nach der Korrektur als Etikett, z. B. "Ø Abweichung 18,4 → 8,0".
export function deviationSummary(report: { meanBefore: number; meanAfter: number }): string {
  return `Ø Abweichung ${oneDecimal(report.meanBefore)} → ${oneDecimal(report.meanAfter)}`;
}
