export interface Point {
  x: number;
  y: number;
}

// Rechteck relativ zum äußeren Kartenrechteck (0..1, Ursprung oben links).
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Rgb = readonly [number, number, number];

// Eckpunkte einer Karte im Bild: oben links, oben rechts, unten rechts, unten links.
export type Corners = readonly [Point, Point, Point, Point];

export interface PatchLayout {
  id: string;
  rect: Rect;
  role?: 'large' | 'strip' | 'neutral';
  // Nennwert (Lab, D50), falls bekannt; nur für Kontrollfelder, nicht aus einer Messung.
  nominalLab?: readonly [number, number, number];
}

export interface CardLayout {
  card: number;
  patches: readonly PatchLayout[];
}

export interface ChartLayout {
  cards: readonly CardLayout[];
}

// Pixelraster beliebiger Kanalzahl (z. B. RGBA mit 0..255 oder RGB mit 0..1).
export interface PixelGrid {
  width: number;
  height: number;
  data: ArrayLike<number>;
  channels: number;
  maxValue: number;
}
