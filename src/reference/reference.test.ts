import { describe, expect, it } from 'vitest';

import { COLOR_IDS, NEUTRAL_IDS } from '../chart/layouts';
import {
  dummyIds,
  dummyLab,
  dummyReferenceCsv,
  dummyReferenceJson,
} from '../test-support/dummy-reference';

import {
  parseReferenceCsv,
  parseReferenceFile,
  parseReferenceJson,
  serializeReferenceJson,
} from './reference';

const rules = { knownIds: COLOR_IDS, neutralIds: NEUTRAL_IDS };

function jsonWith(patches: unknown, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ format: 'cam_gradr-reference/1', patches, ...extra });
}

const neutralPatches = [...NEUTRAL_IDS].map((id) => ({ id, lab: dummyLab(id) }));

describe('parseReferenceJson', () => {
  it('reads a complete file', () => {
    const set = parseReferenceJson(dummyReferenceJson('Mein Satz'), rules);
    expect(set.name).toBe('Mein Satz');
    expect(Object.keys(set.patches)).toHaveLength(48);
    expect(set.patches['1D']).toEqual(dummyLab('1D'));
  });

  it('uses a default name when none is given', () => {
    expect(parseReferenceJson(jsonWith(neutralPatches), rules).name).toBe('Import');
    expect(parseReferenceJson(jsonWith(neutralPatches, { name: '  ' }), rules).name).toBe('Import');
  });

  it('accepts D50 explicitly and rejects other white points', () => {
    expect(() =>
      parseReferenceJson(jsonWith(neutralPatches, { illuminant: 'D50' }), rules),
    ).not.toThrow();
    expect(() =>
      parseReferenceJson(jsonWith(neutralPatches, { illuminant: 'D65' }), rules),
    ).toThrow('D50');
  });

  it('rejects invalid JSON and a wrong format', () => {
    expect(() => parseReferenceJson('{kaputt', rules)).toThrow('kein gültiges JSON');
    expect(() => parseReferenceJson('[]', rules)).toThrow('Unbekanntes Format');
    expect(() => parseReferenceJson('{"format":"x","patches":[]}', rules)).toThrow(
      'Unbekanntes Format',
    );
    expect(() => parseReferenceJson('{"format":"cam_gradr-reference/1"}', rules)).toThrow(
      'Unbekanntes Format',
    );
  });

  it('rejects incomplete or invalid fields', () => {
    expect(() => parseReferenceJson(jsonWith([null]), rules)).toThrow('id');
    expect(() => parseReferenceJson(jsonWith([{ id: '1A' }]), rules)).toThrow('id');
    expect(() => parseReferenceJson(jsonWith([{ id: '1A', lab: [50, 'x', 1] }]), rules)).toThrow(
      'keine Zahlen',
    );
    expect(() => parseReferenceJson(jsonWith([{ id: '1A', lab: [101, 0, 0] }]), rules)).toThrow(
      'außerhalb',
    );
    expect(() => parseReferenceJson(jsonWith([{ id: '1A', lab: [50, 200, 0] }]), rules)).toThrow(
      'außerhalb',
    );
    expect(() => parseReferenceJson(jsonWith([{ id: '1A', lab: [-1, 0, 0] }]), rules)).toThrow(
      'außerhalb',
    );
  });

  it('rejects unknown and duplicate IDs', () => {
    expect(() => parseReferenceJson(jsonWith([{ id: 'ZZ', lab: [50, 0, 0] }]), rules)).toThrow(
      'Unbekannte Feld-ID: ZZ',
    );
    expect(() =>
      parseReferenceJson(
        jsonWith([
          { id: '1A', lab: [50, 0, 0] },
          { id: '1A', lab: [50, 0, 0] },
        ]),
        rules,
      ),
    ).toThrow('Doppelte Feld-ID: 1A');
  });

  it('requires enough fields and enough neutral fields', () => {
    expect(() => parseReferenceJson(jsonWith(neutralPatches.slice(0, 5)), rules)).toThrow(
      'Zu wenige Felder',
    );
    const colourOnly = dummyIds()
      .filter((id) => !NEUTRAL_IDS.has(id))
      .map((id) => ({ id, lab: dummyLab(id) }));
    expect(() => parseReferenceJson(jsonWith(colourOnly), rules)).toThrow(
      'Zu wenige Neutralfelder',
    );
  });
});

describe('parseReferenceCsv', () => {
  it('reads a file with header row and semicolon', () => {
    const set = parseReferenceCsv(dummyReferenceCsv(), 'messung.csv', rules);
    expect(set.name).toBe('messung');
    expect(Object.keys(set.patches)).toHaveLength(48);
    expect(set.patches['1D']?.[0]).toBeCloseTo(dummyLab('1D')[0], 1);
  });

  it('understands comma, tab, decimal comma, comments and empty lines', () => {
    const ids = [...NEUTRAL_IDS];
    const asLine = (separator: string, decimal: string) =>
      ids
        .map((id) =>
          [id, ...dummyLab(id).map((v) => v.toFixed(1).replace('.', () => decimal))].join(
            separator,
          ),
        )
        .join('\n');
    const comma = parseReferenceCsv(`# Kommentar\n\n${asLine(',', '.')}`, 'a.csv', rules);
    const tab = parseReferenceCsv(asLine('\t', '.'), 'a.csv', rules);
    const german = parseReferenceCsv(asLine(';', ','), 'a.csv', rules);
    expect(Object.keys(comma.patches)).toHaveLength(12);
    expect(tab.patches['2D']).toEqual(comma.patches['2D']);
    expect(german.patches['2D']).toEqual(comma.patches['2D']);
  });

  it('rejects empty files and lines with missing values', () => {
    expect(() => parseReferenceCsv('\n\n', 'a.csv', rules)).toThrow('leer');
    expect(() => parseReferenceCsv('1A;50;1', 'a.csv', rules)).toThrow('Zeile 1');
    expect(() => parseReferenceCsv('id;L;a;b\n1A;50;x;1', 'a.csv', rules)).toThrow('Zeile 2');
  });

  it('uses a default name for files without a name', () => {
    const ids = [...NEUTRAL_IDS];
    const text = ids.map((id) => `${id};${dummyLab(id).join(';')}`).join('\n');
    expect(parseReferenceCsv(text, '', rules).name).toBe('Import');
  });
});

describe('parseReferenceFile', () => {
  it('chooses the format by extension or content', () => {
    expect(parseReferenceFile('a.json', dummyReferenceJson('J'), rules).name).toBe('J');
    expect(parseReferenceFile('ohne-endung', dummyReferenceJson('K'), rules).name).toBe('K');
    expect(parseReferenceFile('a.csv', dummyReferenceCsv(), rules).name).toBe('a');
  });
});

describe('serializeReferenceJson', () => {
  it('writes a format that can be read back unchanged', () => {
    const set = parseReferenceJson(dummyReferenceJson('Satz'), rules);
    const text = serializeReferenceJson(set);
    expect(text).toContain('"format": "cam_gradr-reference/1"');
    expect(text.endsWith('\n')).toBe(true);
    expect(parseReferenceJson(text, rules)).toEqual(set);
  });
});
