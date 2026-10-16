import { homographyFromCorners, project } from '../chart/homography';
import type { Homography } from '../chart/homography';
import type { ChartLayout, Corners, Point, Rect } from '../chart/types';

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Shape {
  key: string;
  points: string;
  kind: 'card' | 'large' | 'strip';
}

const CORNER_LABELS = ['oben links', 'oben rechts', 'unten rechts', 'unten links'] as const;

function clamp(value: number, max: number): number {
  return Math.min(Math.max(value, 0), max);
}

// Rechnet einen Klickpunkt (Bildschirmkoordinaten) in Bildkoordinaten des Videos um.
export function clientToImage(client: Point, box: Box, size: Size): Point {
  return {
    x: clamp(((client.x - box.left) / box.width) * size.width, size.width),
    y: clamp(((client.y - box.top) / box.height) * size.height, size.height),
  };
}

function polygon(homography: Homography, rect: Rect): string {
  const corners: [number, number][] = [
    [rect.x, rect.y],
    [rect.x + rect.w, rect.y],
    [rect.x + rect.w, rect.y + rect.h],
    [rect.x, rect.y + rect.h],
  ];
  return corners
    .map(([u, v]) => {
      const point = project(homography, u, v);
      return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    })
    .join(' ');
}

// Umrisse der Karten und ihrer Felder im Bild, für alle Karten mit gesetzten Eckpunkten.
export function buildShapes(
  layout: ChartLayout,
  corners: Readonly<Record<number, Corners | undefined>>,
): Shape[] {
  const shapes: Shape[] = [];
  for (const card of layout.cards) {
    const cardCorners = corners[card.card];
    if (cardCorners !== undefined) {
      const homography = homographyFromCorners(cardCorners);
      shapes.push({
        key: `card-${String(card.card)}`,
        points: polygon(homography, { x: 0, y: 0, w: 1, h: 1 }),
        kind: 'card',
      });
      for (const patch of card.patches) {
        shapes.push({
          key: patch.id,
          points: polygon(homography, patch.rect),
          kind: patch.role === 'large' ? 'large' : 'strip',
        });
      }
    }
  }
  return shapes;
}

// Anweisung für den nächsten Eckpunkt; ohne freien Platz eine Erfolgsmeldung.
export function instructionFor(
  slot: { card: number; index: number } | null,
  cardNames: Readonly<Record<number, string>>,
): string {
  if (slot === null) {
    return 'Alle Eckpunkte sind gesetzt. Sie lassen sich per Ziehen verschieben.';
  }
  const label = CORNER_LABELS[slot.index] ?? '';
  const name = cardNames[slot.card] ?? `Karte ${String(slot.card)}`;
  return `Bitte ${label} der ${name} anklicken (äußerer Rand der dunklen Kartenfläche).`;
}
