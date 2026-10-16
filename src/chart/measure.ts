import { codeLuma } from './exposure';
import type { ExposureInput } from './exposure';
import { homographyFromCorners } from './homography';
import { samplePatch } from './sample';
import type { ChartLayout, Corners, PixelGrid, Rgb } from './types';

export type Measurements = Readonly<Record<string, Rgb>>;

// Misst alle Felder der Karten, für die Eckpunkte vorliegen.
export function measureChart(
  layout: ChartLayout,
  corners: Readonly<Record<number, Corners | undefined>>,
  grid: PixelGrid,
): Measurements {
  const result: Record<string, Rgb> = {};
  for (const card of layout.cards) {
    const cardCorners = corners[card.card];
    if (cardCorners !== undefined) {
      const homography = homographyFromCorners(cardCorners);
      for (const patch of card.patches) {
        const value = samplePatch(grid, homography, patch.rect);
        if (value !== null) {
          result[patch.id] = value;
        }
      }
    }
  }
  return result;
}

function darkest(values: readonly Rgb[]): Rgb | undefined {
  return values.toSorted((a, b) => codeLuma(a) - codeLuma(b))[0];
}

function brightest(values: readonly Rgb[]): Rgb | undefined {
  return values.toSorted((a, b) => codeLuma(b) - codeLuma(a))[0];
}

function pick(measurements: Measurements, ids: readonly string[]): Rgb[] {
  return ids.map((id) => measurements[id]).filter((value) => value !== undefined);
}

const STRIP_DARK_IDS = ['S3-0', 'S4-0'] as const;
const STRIP_LIGHT_IDS = ['S3-5', 'S4-5'] as const;

// Leitet aus den Messwerten die Eingabe der Belichtungsbewertung ab (null, wenn Felder fehlen).
export function exposureInput(measurements: Measurements): ExposureInput | null {
  const large18 = measurements.G18;
  const large50 = measurements.G50;
  const stripDark = darkest(pick(measurements, STRIP_DARK_IDS));
  const stripLight = brightest(pick(measurements, STRIP_LIGHT_IDS));
  if (
    large18 === undefined ||
    large50 === undefined ||
    stripDark === undefined ||
    stripLight === undefined
  ) {
    return null;
  }
  return { large18, large50, stripDark, stripLight };
}
