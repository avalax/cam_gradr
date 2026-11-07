import type { Vec3 } from '../color/lab';

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

// An RGB value (sRGB-encoded, 0..1), such as a measured camera value.
export type Rgb = Vec3;

// Corners of a chart in the image: top left, top right, bottom right, bottom left.
export type Corners = readonly [Point, Point, Point, Point];

export interface PatchLayout {
  id: string;
  rect: Rect;
  role?: 'large' | 'strip' | 'neutral';
  // Nominal value (Lab, D50) if known; only for check patches, not from a measurement.
  nominalLab?: Vec3;
}

export interface CardLayout {
  card: number;
  patches: readonly PatchLayout[];
}

export interface ChartLayout {
  cards: readonly CardLayout[];
}
