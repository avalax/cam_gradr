import { describe, expect, it } from 'vitest';

import { NEUTRAL_IDS } from '../chart/layouts';
import type { Rgb } from '../chart/types';
import { fitColorModel } from '../solve/fit';
import { parseCube } from '../test-support/cube-parse';
import { dummyIds, dummyLab } from '../test-support/dummy-reference';
import { cameraCode } from '../test-support/synthetic-camera';

import { CUBE_SIZES, formatCube } from './cube';
import { buildLut, identityLut } from './lut';

const reference = {
  name: 'Test',
  patches: Object.fromEntries(dummyIds().map((id) => [id, dummyLab(id)])),
};
const measurements: Record<string, Rgb> = Object.fromEntries(
  dummyIds().map((id) => [id, cameraCode(dummyLab(id))]),
);
const { model } = fitColorModel({ measurements, reference, neutralIds: NEUTRAL_IDS });

describe('formatCube', () => {
  it('schreibt Kopf und eine Zeile je Gitterpunkt im .cube-Format', () => {
    const text = formatCube(identityLut(2), 'Test');
    const lines = text.trimEnd().split('\n');
    expect(lines.slice(0, 5)).toEqual([
      '# Erzeugt von cam_gradr',
      'TITLE "Test"',
      'LUT_3D_SIZE 2',
      'DOMAIN_MIN 0.000000 0.000000 0.000000',
      'DOMAIN_MAX 1.000000 1.000000 1.000000',
    ]);
    expect(lines).toHaveLength(5 + 8);
    // R läuft am schnellsten, dann G, dann B.
    expect(lines.slice(5, 8)).toEqual([
      '0.000000 0.000000 0.000000',
      '1.000000 0.000000 0.000000',
      '0.000000 1.000000 0.000000',
    ]);
    expect(lines.at(-1)).toBe('1.000000 1.000000 1.000000');
    expect(text.endsWith('\n')).toBe(true);
    expect(text).not.toContain('\r');
  });

  it('enthält für jede wählbare Größe size³ Zeilen', () => {
    for (const size of CUBE_SIZES) {
      const lines = formatCube(identityLut(size), 'x').trimEnd().split('\n');
      expect(lines).toHaveLength(5 + size ** 3);
    }
  });

  it('übersteht die Rundreise mit sechs Nachkommastellen Genauigkeit', () => {
    const lut = buildLut(model, 17);
    const parsed = parseCube(formatCube(lut, 'Rundreise'));
    expect(parsed.title).toBe('Rundreise');
    expect(parsed.lut.size).toBe(17);
    expect(parsed.domainMin).toEqual([0, 0, 0]);
    expect(parsed.domainMax).toEqual([1, 1, 1]);
    expect(parsed.lut.data).toHaveLength(lut.data.length);
    for (const index of [0, 5, 100, 4000, lut.data.length - 1]) {
      expect(parsed.lut.data[index]).toBeCloseTo(Number(lut.data[index]), 5);
    }
  });

  it('nutzt immer den Dezimalpunkt und ersetzt Anführungszeichen im Titel', () => {
    const text = formatCube(identityLut(2), 'Mein "Titel"');
    expect(text).toContain('TITLE "Mein \'Titel\'"');
    expect(text).not.toMatch(/\d,\d/);
  });
});
