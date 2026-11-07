/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access -- the tests deliberately modify JSON without fixed types */
import { describe, expect, it } from 'vitest';

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
const { model } = fitColorModel({ measurements, reference });

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
    preview: { split: 25 },
  };
}

// Creates a copy of the sample file with one change and checks that it is rejected.
function rejects(change: (raw: Record<string, any>) => void, message: string | RegExp): void {
  const raw = structuredClone(sample()) as unknown as Record<string, any>;
  change(raw);
  expect(() => parseProject(JSON.stringify(raw))).toThrow(message);
}

describe('parseProject', () => {
  it('reads what serializeProject writes (round trip)', () => {
    const text = serializeProject(sample());
    expect(text.endsWith('\n')).toBe(true);
    expect(parseProject(text)).toEqual(sample());
  });

  it('accepts a project without model and without reference', () => {
    const raw = JSON.parse(serializeProject(sample())) as Record<string, any>;
    raw.model = null;
    raw.color.reference = null;
    const project = parseProject(JSON.stringify(raw));
    expect(project.model).toBeNull();
    expect(project.color.reference).toBeNull();
  });

  it('reads older files with strength and ignores it', () => {
    const raw = JSON.parse(serializeProject(sample())) as Record<string, any>;
    raw.preview = { strength: 60, split: 25 };
    const project = parseProject(JSON.stringify(raw));
    expect(project.preview).toEqual({ split: 25 });
    expect(serializeProject(project)).not.toContain('strength');
  });

  it('saves no reference values, only their name', () => {
    const text = serializeProject(sample());
    expect(text).toContain('"reference": "Mein Satz"');
    expect(text).not.toContain('"lab"');
    for (const id of ['1A', '3F']) {
      expect(text).not.toContain(JSON.stringify(dummyLab(id)));
    }
  });

  it('rejects invalid JSON and a wrong format', () => {
    expect(() => parseProject('{kaputt')).toThrow('kein gültiges JSON');
    expect(() => parseProject('[]')).toThrow('Unbekanntes Format');
    rejects((raw) => (raw.format = 'anderes/1'), 'Unbekanntes Format');
    // Every version since 1.0.0 writes the time of saving.
    rejects((raw) => delete raw.savedAt, 'Zeitpunkt der Sicherung fehlt');
  });

  it('rejects faulty chart sections', () => {
    rejects((raw) => delete raw.gray, 'Graukarten: erwartet werden');
    rejects((raw) => (raw.color.measurements = 5), 'Farbkarten: erwartet werden');
    rejects((raw) => delete raw.gray.rotated, 'Graukarten: erwartet werden');
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

  it('rejects unknown fields and invalid measurements', () => {
    rejects((raw) => (raw.gray.measurements = { ZZ: [0, 0, 0] }), 'unbekanntes Feld ZZ');
    rejects((raw) => (raw.color.measurements = { '1A': [0, 0] }), '3 Zahlen');
    rejects((raw) => (raw.color.measurements = { '1A': [0, 0, 'x'] }), '3 Zahlen');
    rejects((raw) => (raw.color.measurements = { '1A': [0, 0, 2] }), 'zwischen 0 und 1');
    rejects((raw) => (raw.color.measurements = { '1A': [-0.1, 0, 0] }), 'zwischen 0 und 1');
  });

  it('rejects an invalid reference', () => {
    rejects((raw) => (raw.color.reference = 5), 'reference muss ein Name oder null sein');
    rejects((raw) => delete raw.color.reference, 'reference muss ein Name oder null sein');
  });

  it('rejects a faulty model', () => {
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
    rejects((raw) => (raw.model.hue = [1, 2]), 'Farbton-Tabelle braucht 10 Zahlen');
    rejects((raw) => (raw.model.hue = 'x'), 'Farbton-Tabelle braucht 10 Zahlen');
    rejects((raw) => (raw.model.hue[3] = null), 'Farbton-Tabelle braucht 10 Zahlen');
  });

  it('reads models from before the hue table without one', () => {
    const raw = structuredClone(sample()) as unknown as { model: Record<string, unknown> };
    delete raw.model.hue;
    expect(parseProject(JSON.stringify(raw)).model?.hue).toBeUndefined();
  });

  it('rejects faulty preview settings', () => {
    rejects((raw) => delete raw.preview, 'Einstellungen fehlen');
    rejects((raw) => (raw.preview.split = -1), 'Trennlinie muss zwischen 0 und 100');
    rejects((raw) => (raw.preview.split = 'x'), 'Trennlinie muss zwischen 0 und 100');
  });

  it('reads and writes the chosen look LUT by name and strength, never its data', () => {
    const project = { ...sample(), preview: { split: 25, look: { name: 'Warm', strength: 70 } } };
    const text = serializeProject(project);
    expect(parseProject(text)).toEqual(project);
    expect(JSON.parse(text).preview).toEqual({ split: 25, look: { name: 'Warm', strength: 70 } });
  });

  it('reads the look LUTs saved along', () => {
    const looks = [
      {
        name: 'Warm',
        size: 2,
        min: [0, 0, 0] as const,
        max: [1, 1, 1] as const,
        encoding: 'f32le-deflate-base64' as const,
        data: 'eJw=',
      },
    ];
    const project: Project = { ...sample(), looks };
    expect(parseProject(serializeProject(project))).toEqual(project);
  });

  it('rejects broken look LUTs', () => {
    const look = {
      name: 'Warm',
      size: 2,
      min: [0, 0, 0],
      max: [1, 1, 1],
      encoding: 'f32le-deflate-base64',
      data: '',
    };
    const withLook = (change: Record<string, unknown>) => (raw: Record<string, any>) => {
      raw.looks = [{ ...look, ...change }];
    };
    rejects(withLook({ name: 5 }), 'gespeicherten Look-LUTs sind ungültig');
    rejects(withLook({ encoding: 'png' }), 'gespeicherten Look-LUTs sind ungültig');
    rejects(withLook({ data: 5 }), 'gespeicherten Look-LUTs sind ungültig');
    rejects(withLook({ size: 1 }), 'gespeicherten Look-LUTs sind ungültig');
    rejects(withLook({ size: 130 }), 'gespeicherten Look-LUTs sind ungültig');
    rejects(withLook({ min: [0, 0] }), 'erwartet werden 3 Zahlen');
    rejects((raw) => (raw.looks = 'Warm'), 'ungültig');
  });

  it('rejects a faulty look LUT', () => {
    rejects((raw) => (raw.preview.look = 'Warm'), 'braucht name und strength');
    rejects((raw) => (raw.preview.look = { strength: 50 }), 'braucht name und strength');
    rejects(
      (raw) => (raw.preview.look = { name: 'Warm', strength: 101 }),
      'Stärke der Look-LUT muss zwischen 0 und 100',
    );
  });
});

describe('still images in the project file', () => {
  const still = { width: 2, height: 1, encoding: 'rgb8-deflate-base64', data: 'eJw=' };

  function withStills(stills: unknown): string {
    return JSON.stringify({ ...JSON.parse(serializeProject(sample())), stills });
  }

  it('omits still images when they are missing', () => {
    expect(parseProject(serializeProject(sample())).stills).toBeUndefined();
  });

  it('reads the still images per tab', () => {
    const project = parseProject(withStills({ gray: still, preview: still }));
    expect(Object.keys(project.stills ?? {})).toEqual(['gray', 'preview']);
    expect(project.stills?.gray).toEqual(still);
  });

  it('rejects unknown tabs, encodings and sizes', () => {
    expect(() => parseProject(withStills('x'))).toThrow('erwartet wird ein Objekt');
    expect(() => parseProject(withStills({ export: still }))).toThrow('unbekannter Tab');
    expect(() => parseProject(withStills({ gray: { ...still, encoding: 'png' } }))).toThrow(
      'unbekannte Codierung',
    );
    expect(() => parseProject(withStills({ gray: { ...still, data: 5 } }))).toThrow(
      'unbekannte Codierung',
    );
    expect(() => parseProject(withStills({ gray: 'x' }))).toThrow('unbekannte Codierung');
    expect(() => parseProject(withStills({ gray: { ...still, width: 0 } }))).toThrow(
      'ungültige Größe',
    );
    expect(() => parseProject(withStills({ gray: { ...still, height: 1.5 } }))).toThrow(
      'ungültige Größe',
    );
    expect(() => parseProject(withStills({ gray: { ...still, width: 100_000 } }))).toThrow(
      'ungültige Größe',
    );
  });
});
