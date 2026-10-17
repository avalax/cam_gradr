/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access -- die Tests verändern JSON bewusst ohne feste Typen */
import { describe, expect, it } from 'vitest';

import { NEUTRAL_IDS } from '../chart/layouts';
import type { Rgb } from '../chart/types';
import { fitColorModel } from '../solve/fit';
import { dummyIds, dummyLab } from '../test-support/dummy-reference';
import { cameraCode } from '../test-support/synthetic-camera';

import { PROJECT_FORMAT, parseProject, serializeProject } from './project';
import type { Project } from './project';

const reference = {
  name: 'Test',
  patches: Object.fromEntries(dummyIds().map((id) => [id, dummyLab(id)])),
};
const measurements: Record<string, Rgb> = Object.fromEntries(
  dummyIds().map((id) => [id, cameraCode(dummyLab(id))]),
);
const { model } = fitColorModel({ measurements, reference, neutralIds: NEUTRAL_IDS });

function sample(): Project {
  return {
    format: PROJECT_FORMAT,
    savedAt: '2026-10-17T12:00:00.000Z',
    gray: {
      corners: {
        3: [
          { x: 1, y: 2 },
          { x: 3, y: 4 },
        ],
      },
      measurements: { G18: [0.46, 0.46, 0.46], 'S4-0': [0.1, 0.1, 0.1] },
      rotated: false,
    },
    color: { corners: {}, measurements, rotated: false, reference: 'Mein Satz' },
    model,
    preview: { strength: 80, split: 25 },
  };
}

// Erzeugt eine Kopie der Beispieldatei mit einer Änderung und prüft, dass sie abgelehnt wird.
function rejects(change: (raw: Record<string, any>) => void, message: string | RegExp): void {
  const raw = structuredClone(sample()) as unknown as Record<string, any>;
  change(raw);
  expect(() => parseProject(JSON.stringify(raw))).toThrow(message);
}

describe('parseProject', () => {
  it('liest, was serializeProject schreibt (Rundreise)', () => {
    const text = serializeProject(sample());
    expect(text.endsWith('\n')).toBe(true);
    expect(parseProject(text)).toEqual(sample());
  });

  it('akzeptiert ein Projekt ohne Modell, ohne Referenz und ohne Datum', () => {
    const raw = JSON.parse(serializeProject(sample())) as Record<string, any>;
    raw.model = null;
    raw.color.reference = null;
    delete raw.savedAt;
    const project = parseProject(JSON.stringify(raw));
    expect(project.model).toBeNull();
    expect(project.color.reference).toBeNull();
    expect(project.savedAt).toBe('');
  });

  it('speichert keine Referenzwerte, nur deren Namen', () => {
    const text = serializeProject(sample());
    expect(text).toContain('"reference": "Mein Satz"');
    expect(text).not.toContain('"lab"');
    for (const id of ['1A', '3F']) {
      expect(text).not.toContain(JSON.stringify(dummyLab(id)));
    }
  });

  it('lehnt ungültiges JSON und falsches Format ab', () => {
    expect(() => parseProject('{kaputt')).toThrow('kein gültiges JSON');
    expect(() => parseProject('[]')).toThrow('Unbekanntes Format');
    rejects((raw) => (raw.format = 'anderes/1'), 'Unbekanntes Format');
  });

  it('lehnt fehlerhafte Kartenabschnitte ab', () => {
    rejects((raw) => delete raw.gray, 'Graukarten: erwartet werden');
    rejects((raw) => (raw.color.measurements = 5), 'Farbkarten: erwartet werden');
    rejects((raw) => (raw.gray.corners = { 1: [] }), 'unbekannte Karte 1');
    rejects((raw) => (raw.color.corners = { 3: [] }), 'unbekannte Karte 3');
    rejects((raw) => (raw.gray.corners = { 3: 'x' }), 'ungültige Eckpunktliste');
    rejects(
      (raw) => (raw.gray.corners = { 3: Array.from({ length: 5 }, () => ({ x: 1, y: 1 })) }),
      'ungültige Eckpunktliste',
    );
    rejects((raw) => (raw.gray.corners = { 3: [{ x: 'a', y: 1 }] }), 'braucht x und y');
    rejects((raw) => (raw.gray.corners = { 3: [null] }), 'braucht x und y');
  });

  it('lehnt unbekannte Felder und ungültige Messwerte ab', () => {
    rejects((raw) => (raw.gray.measurements = { ZZ: [0, 0, 0] }), 'unbekanntes Feld ZZ');
    rejects((raw) => (raw.color.measurements = { '1A': [0, 0] }), '3 Zahlen');
    rejects((raw) => (raw.color.measurements = { '1A': [0, 0, 'x'] }), '3 Zahlen');
    rejects((raw) => (raw.color.measurements = { '1A': [0, 0, 2] }), 'zwischen 0 und 1');
    rejects((raw) => (raw.color.measurements = { '1A': [-0.1, 0, 0] }), 'zwischen 0 und 1');
  });

  it('lehnt eine ungültige Referenz ab', () => {
    rejects((raw) => (raw.color.reference = 5), 'reference muss ein Name oder null sein');
    rejects((raw) => delete raw.color.reference, 'reference muss ein Name oder null sein');
  });

  it('lehnt ein fehlerhaftes Modell ab', () => {
    rejects((raw) => (raw.model = 5), 'drei Kurven');
    rejects((raw) => (raw.model = { curves: [] }), 'drei Kurven');
    rejects((raw) => (raw.model.curves[0] = null), 'Kurve 1: erwartet werden xs und ys');
    rejects((raw) => (raw.model.curves[1].xs = [0]), 'Kurve 2: ungültige Stützpunkte');
    rejects((raw) => (raw.model.curves[1].ys = [0]), 'Kurve 2: ungültige Stützpunkte');
    rejects((raw) => (raw.model.curves[2].xs = [0, 0]), 'Kurve 3: ungültige Stützpunkte');
    rejects((raw) => (raw.model.curves[0].ys[0] = 'a'), 'Kurve 1: ungültige Stützpunkte');
    rejects((raw) => (raw.model.matrix = [[1, 0, 0]]), 'drei Zeilen');
    rejects((raw) => delete raw.model.matrix, 'drei Zeilen');
    rejects((raw) => (raw.model.matrix[0] = [1, 2]), 'Matrix: erwartet werden 3 Zahlen');
  });

  it('lehnt fehlerhafte Vorschau-Einstellungen ab', () => {
    rejects((raw) => delete raw.preview, 'Einstellungen fehlen');
    rejects((raw) => (raw.preview.strength = 120), 'Stärke muss zwischen 0 und 100');
    rejects((raw) => (raw.preview.split = -1), 'Trennlinie muss zwischen 0 und 100');
    rejects((raw) => (raw.preview.split = 'x'), 'Trennlinie muss zwischen 0 und 100');
  });
});
