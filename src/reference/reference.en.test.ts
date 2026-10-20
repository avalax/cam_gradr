import { IDBFactory } from 'fake-indexeddb';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { COLOR_IDS, NEUTRAL_IDS } from '../chart/layouts';
import { setLocale } from '../lang';
import { dummyLab, dummyReferenceJson } from '../test-support/dummy-reference';

import { parseReferenceCsv, parseReferenceJson } from './reference';
import { setReferenceStorage, useReferenceStore } from './reference-store';
import { createIndexedDbStorage } from './storage';
import type { ReferenceStorage } from './storage';

const rules = { knownIds: COLOR_IDS, neutralIds: NEUTRAL_IDS };

function jsonWith(patches: unknown, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ format: 'cam_gradr-reference/1', patches, ...extra });
}

const neutralPatches = [...NEUTRAL_IDS].map((id) => ({ id, lab: dummyLab(id) }));

describe('reference files in English', () => {
  beforeEach(() => {
    setLocale('en');
  });

  it('reports JSON errors in English', () => {
    expect(() => parseReferenceJson('{broken', rules)).toThrow('The file is not valid JSON');
    expect(() => parseReferenceJson('[]', rules)).toThrow(
      'Unknown format, expected "cam_gradr-reference/1"',
    );
    expect(() => parseReferenceJson(jsonWith([], { illuminant: 'D65' }), rules)).toThrow(
      'Only Lab values with white point D50 are supported',
    );
    expect(() => parseReferenceJson(jsonWith([5]), rules)).toThrow('A patch needs "id" and "lab"');
    expect(() => parseReferenceJson(jsonWith([{ id: '1A', lab: ['x', 0, 0] }]), rules)).toThrow(
      'Patch 1A: Lab values are not numbers',
    );
    expect(() => parseReferenceJson(jsonWith([{ id: '1A', lab: [500, 0, 0] }]), rules)).toThrow(
      'Patch 1A: Lab value outside the valid range',
    );
  });

  it('reports patch set errors in English', () => {
    expect(() => parseReferenceJson(jsonWith([{ id: 'nope', lab: [50, 0, 0] }]), rules)).toThrow(
      'Unknown patch ID: nope',
    );
    expect(() =>
      parseReferenceJson(
        jsonWith([
          { id: '1A', lab: [50, 0, 0] },
          { id: '1A', lab: [50, 0, 0] },
        ]),
        rules,
      ),
    ).toThrow('Duplicate patch ID: 1A');
    expect(() => parseReferenceJson(jsonWith(neutralPatches.slice(0, 5)), rules)).toThrow(
      'Too few patches: at least 12 required',
    );
    const colored = [...COLOR_IDS]
      .filter((id) => !NEUTRAL_IDS.has(id))
      .slice(0, 12)
      .map((id) => ({ id, lab: dummyLab(id) }));
    expect(() => parseReferenceJson(jsonWith(colored), rules)).toThrow(
      'Too few neutral patches (gray ramps): at least 4 required',
    );
  });

  it('reports CSV errors in English', () => {
    expect(() => parseReferenceCsv('', 'a.csv', rules)).toThrow('The file is empty');
    expect(() => parseReferenceCsv('id;L;a;b\n1A;50', 'a.csv', rules)).toThrow(
      'Line 2: expected id, L, a, b',
    );
    expect(() => parseReferenceCsv('1A;500;0;0', 'a.csv', rules)).toThrow(
      'Line 1: Lab value outside the valid range',
    );
  });
});

describe('reference store in English', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    setLocale('en');
  });

  it('shows the storage warnings in English', async () => {
    const fail = () => Promise.reject(new Error('broken'));
    const failing: ReferenceStorage = { list: fail, save: fail, remove: fail };
    setReferenceStorage(failing);
    const store = useReferenceStore();
    await store.load();
    expect(store.warning).toBe('Saved references could not be loaded.');
    await store.importFile('a.json', dummyReferenceJson('Set A'));
    expect(store.warning).toBe(
      'The set could not be saved locally and only applies to this session.',
    );
    await store.remove('Set A');
    expect(store.warning).toBe('The set could not be deleted locally.');
  });

  it('shows import errors in English', async () => {
    setReferenceStorage(createIndexedDbStorage(new IDBFactory(), 'test-en'));
    const store = useReferenceStore();
    await store.importFile('a.json', '{broken');
    expect(store.error).toBe('The file is not valid JSON');
  });
});
