import type { Corners } from '../chart/types';

// Hilfsrahmen im Livebild: zeigt, wo die Karten hingehalten werden sollen. Die Karten sind hochkant,
// der Rahmen füllt den größten Teil der Bildhöhe und sitzt je in einer Bildhälfte.
const HEIGHT_SHARE = 0.83;
const ASPECT = 2 / 3;
const MARGIN_SHARE = 0.25;

// Ecken der Rahmen für `count` Karten, von links nach rechts (oben links, oben rechts, unten rechts,
// unten links).
export function guideCorners(size: { width: number; height: number }, count: number): Corners[] {
  const height = size.height * HEIGHT_SHARE;
  const width = height * ASPECT;
  const top = (size.height - height) / 2;
  return Array.from({ length: count }, (_, index) => {
    const centre =
      size.width * (MARGIN_SHARE + ((1 - 2 * MARGIN_SHARE) * index) / Math.max(1, count - 1));
    const left = centre - width / 2;
    return [
      { x: left, y: top },
      { x: left + width, y: top },
      { x: left + width, y: top + height },
      { x: left, y: top + height },
    ];
  });
}
