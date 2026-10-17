import type { Corners } from '../chart/types';

// Hilfsrahmen im Livebild: zeigt, wo die Karten (dunkler Rahmen der Karte) hingehalten werden sollen.
// Maße aus einem Foto des geöffneten Etuis: hochkant, Breite zu Höhe etwa 0,63.
const HEIGHT_SHARE = 0.81;
const ASPECT = 0.63;
// Mittelpunkte der Karten im Bild (Anteil der Breite): so liegen sie im aufgeklappten Etui, wenn es
// formatfüllend gehalten wird; zwischen den Karten bleibt nur das Scharnier.
const FIRST_CENTRE = 0.34;
const CENTRE_SPACING = 0.36;

// Ecken der Rahmen für `count` Karten, von links nach rechts (oben links, oben rechts, unten rechts,
// unten links).
export function guideCorners(size: { width: number; height: number }, count: number): Corners[] {
  const height = size.height * HEIGHT_SHARE;
  const width = height * ASPECT;
  const top = (size.height - height) / 2;
  return Array.from({ length: count }, (_, index) => {
    const centre = size.width * (FIRST_CENTRE + CENTRE_SPACING * index);
    const left = centre - width / 2;
    return [
      { x: left, y: top },
      { x: left + width, y: top },
      { x: left + width, y: top + height },
      { x: left, y: top + height },
    ];
  });
}
