import { describe, expect, it } from 'vitest';

import { grayLayout } from '../chart/layouts';
import type { ChartLayout, Corners } from '../chart/types';

import { buildShapes, clientToImage } from './overlay-geometry';

describe('clientToImage', () => {
  const box = { left: 100, top: 50, width: 400, height: 200 };
  const size = { width: 1280, height: 720 };

  it('rechnet Bildschirm- in Bildkoordinaten um', () => {
    expect(clientToImage({ x: 300, y: 150 }, box, size)).toEqual({ x: 640, y: 360 });
  });

  it('is limited to the image area', () => {
    expect(clientToImage({ x: 0, y: 0 }, box, size)).toEqual({ x: 0, y: 0 });
    expect(clientToImage({ x: 9999, y: 9999 }, box, size)).toEqual({ x: 1280, y: 720 });
  });
});

describe('buildShapes', () => {
  const layout: ChartLayout = {
    cards: [
      {
        card: 3,
        patches: [
          { id: 'G50', role: 'large', rect: { x: 0, y: 0, w: 0.5, h: 0.5 } },
          { id: 'S3-0', role: 'strip', rect: { x: 0.5, y: 0.5, w: 0.5, h: 0.5 } },
          { id: 'plain', rect: { x: 0, y: 0.5, w: 0.5, h: 0.5 } },
        ],
      },
      { card: 4, patches: [] },
    ],
  };
  const corners: Corners = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ];

  it('creates outlines for card and patches, only for cards with corner points', () => {
    const shapes = buildShapes(layout, { 3: corners });
    expect(shapes.map((shape) => [shape.key, shape.kind])).toEqual([
      ['card-3', 'card'],
      ['G50', 'large'],
      ['S3-0', 'strip'],
      ['plain', 'strip'],
    ]);
    expect(shapes[0]?.points).toBe('0.0,0.0 100.0,0.0 100.0,100.0 0.0,100.0');
    expect(shapes[1]?.points).toBe('0.0,0.0 50.0,0.0 50.0,50.0 0.0,50.0');
  });

  it('returns no outlines without corner points', () => {
    expect(buildShapes(layout, {})).toEqual([]);
  });

  it('places the patches of the gray cards as on the real cards', () => {
    // Both cards upright, 400 × 600 pixels: card 3 (50 %) on the left, card 4 (18 %) on the right.
    const card = (x: number): Corners => [
      { x, y: 50 },
      { x: x + 400, y: 50 },
      { x: x + 400, y: 650 },
      { x, y: 650 },
    ];
    const shapes = buildShapes(grayLayout, { 3: card(100), 4: card(700) });
    const box = (key: string) => {
      const points = (shapes.find((shape) => shape.key === key)?.points ?? '')
        .split(' ')
        .map((pair) => pair.split(',').map(Number));
      const xs = points.map(([x = 0]) => x);
      const ys = points.map(([, y = 0]) => y);
      return {
        x: Math.min(...xs),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
      };
    };
    const [g50, g18, s3, s4] = [box('G50'), box('G18'), box('S3-0'), box('S4-0')];
    // Large patches are upright; the strip lies right of the large patch on the left card and
    // left of it on the right card.
    expect(g50.height).toBeGreaterThan(g50.width);
    expect(g18.height).toBeGreaterThan(g18.width);
    expect(s3.x).toBeGreaterThan(g50.x);
    expect(s4.x).toBeLessThan(g18.x);
  });
});
