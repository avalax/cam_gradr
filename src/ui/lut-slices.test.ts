import { describe, expect, it } from 'vitest';

import type { ColorModel } from '../solve/fit';

import { cubeSizeText, lutSlices } from './lut-slices';

const identity: ColorModel = {
  curves: [
    { xs: [0, 1], ys: [0, 1] },
    { xs: [0, 1], ys: [0, 1] },
    { xs: [0, 1], ys: [0, 1] },
  ],
  matrix: [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
};

describe('lutSlices', () => {
  it('liefert vier Schnitte mit je cells × cells Farben', () => {
    const slices = lutSlices(identity, 4);
    expect(slices).toHaveLength(4);
    for (const slice of slices) {
      expect(slice).toHaveLength(16);
    }
  });

  it('zeigt bei der Identität unten links Schwarz mit dem Blauanteil und oben rechts Gelb', () => {
    const [first] = lutSlices(identity, 4);
    // Unten links: Rot 0, Grün 0, Blau 0,15 (Anteil 38 von 255).
    const bottomLeft = first?.[12] ?? '';
    expect(bottomLeft).toMatch(/^rgb\(0, 0, \d+\)$/);
    // Oben rechts: Rot 1, Grün 1.
    expect(first?.[3]).toMatch(/^rgb\(255, 255, \d+\)$/);
  });

  it('gibt Korrekturen weiter: ein Rotstich im Modell färbt die Felder', () => {
    const tinted: ColorModel = {
      ...identity,
      matrix: [
        [1, 0, 0],
        [0.3, 0.7, 0],
        [0, 0, 1],
      ],
    };
    expect(lutSlices(tinted, 2)).not.toEqual(lutSlices(identity, 2));
  });
});

describe('cubeSizeText', () => {
  it('schätzt die Dateigröße der drei Größen', () => {
    expect(cubeSizeText(17)).toBe('ca. 133 KB');
    expect(cubeSizeText(33)).toBe('ca. 970 KB');
    expect(cubeSizeText(65)).toBe('ca. 7,4 MB');
  });
});
