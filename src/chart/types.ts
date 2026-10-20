export interface Point {
  x: number;
  y: number;
}

// Rectangle relative to the outer chart rectangle (0..1, origin top left).
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Rgb = readonly [number, number, number];

// Corners of a chart in the image: top left, top right, bottom right, bottom left.
export type Corners = readonly [Point, Point, Point, Point];

export interface PatchLayout {
  id: string;
  rect: Rect;
  role?: 'large' | 'strip' | 'neutral';
  // Nominal value (Lab, D50) if known; only for check patches, not from a measurement.
  nominalLab?: readonly [number, number, number];
}

export interface CardLayout {
  card: number;
  patches: readonly PatchLayout[];
}

export interface ChartLayout {
  cards: readonly CardLayout[];
}

// Pixel grid with any number of channels (e.g. RGBA with 0..255 or RGB with 0..1).
export interface PixelGrid {
  width: number;
  height: number;
  data: ArrayLike<number>;
  channels: number;
  maxValue: number;
}
