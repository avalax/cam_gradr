import { describe, expect, it } from 'vitest';

import { setLocale } from '../lang';

import { decodeFrame } from './frame-codec';
import { PROJECT_FORMAT, parseProject } from './project';

function chart(extra: Record<string, unknown> = {}) {
  return { corners: {}, measurements: {}, ...extra };
}

function project(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    format: PROJECT_FORMAT,
    gray: chart(),
    color: { ...chart(), reference: null },
    model: null,
    preview: { split: 50 },
    ...overrides,
  });
}

describe('parseProject in English', () => {
  it('reports the file level errors in English', () => {
    setLocale('en');
    expect(() => parseProject('{broken')).toThrow('The file is not valid JSON');
    expect(() => parseProject('[]')).toThrow(`Unknown format, expected "${PROJECT_FORMAT}"`);
    expect(() => parseProject(project({ preview: 5 }))).toThrow('Preview: settings are missing');
    expect(() => parseProject(project({ color: { ...chart(), reference: 5 } }))).toThrow(
      'Color cards: reference must be a name or null',
    );
  });

  it('names the chart, the card and the field in English', () => {
    setLocale('en');
    expect(() => parseProject(project({ gray: 5 }))).toThrow(
      'Gray cards: corners and measurements expected',
    );
    expect(() => parseProject(project({ gray: chart({ corners: { 9: [] } }) }))).toThrow(
      'Gray cards: unknown card 9',
    );
    expect(() =>
      parseProject(project({ gray: chart({ corners: { 3: [1, 2, 3, 4, 5] } }) })),
    ).toThrow('Gray cards: card 3 has an invalid list of corner points');
    expect(() => parseProject(project({ gray: chart({ corners: { 3: [{ x: 1 }] } }) }))).toThrow(
      'Gray cards, card 3: a corner point needs x and y',
    );
    expect(() =>
      parseProject(project({ gray: chart({ measurements: { nope: [0, 0, 0] } }) })),
    ).toThrow('Gray cards: unknown field nope');
    expect(() => parseProject(project({ gray: chart({ measurements: { G18: [0, 0] } }) }))).toThrow(
      'Gray cards, field G18: 3 numbers expected',
    );
    expect(() =>
      parseProject(project({ gray: chart({ measurements: { G18: [0, 0, 2] } }) })),
    ).toThrow('Gray cards, field G18: values must be between 0 and 1');
  });

  it('reports model, preview and still image errors in English', () => {
    setLocale('en');
    expect(() => parseProject(project({ model: 5 }))).toThrow(
      'Model: three curves and a matrix expected',
    );
    expect(() => parseProject(project({ model: { curves: [5, 5, 5] } }))).toThrow(
      'Model, curve 1: xs and ys expected',
    );
    const curve = { xs: [0, 1], ys: [0, 1] };
    expect(() =>
      parseProject(project({ model: { curves: [curve, curve, curve], matrix: 1 } })),
    ).toThrow('Model: the matrix needs three rows');
    expect(() =>
      parseProject(
        project({ model: { curves: [curve, curve, { xs: [0], ys: [0] }], matrix: [] } }),
      ),
    ).toThrow('Model, curve 3: invalid control points');
    expect(() =>
      parseProject(project({ model: { curves: [curve, curve, curve], matrix: [1, 2, 3] } })),
    ).toThrow('Model, matrix: 3 numbers expected');
    expect(() => parseProject(project({ preview: { split: 101 } }))).toThrow(
      'Preview: wipe slider must be between 0 and 100',
    );
    expect(() => parseProject(project({ stills: 'x' }))).toThrow(
      'Still images: an object is expected',
    );
    expect(() => parseProject(project({ stills: { export: {} } }))).toThrow(
      'Still images: unknown tab "export"',
    );
    expect(() => parseProject(project({ stills: { gray: 'x' } }))).toThrow(
      'Still image "gray": unknown encoding',
    );
    expect(() =>
      parseProject(
        project({
          stills: { gray: { encoding: 'rgb8-deflate-base64', data: '', width: 0, height: 1 } },
        }),
      ),
    ).toThrow('Still image "gray": invalid size');
  });

  it('reports unreadable and wrongly sized still images in English', async () => {
    setLocale('en');
    const encoding = 'rgb8-deflate-base64' as const;
    await expect(decodeFrame({ width: 1, height: 1, encoding, data: 'AAAA' })).rejects.toThrow(
      'A still image in the file cannot be read',
    );
    // A valid deflate stream with zero bytes does not match a 1 x 1 image.
    await expect(
      decodeFrame({ width: 1, height: 1, encoding, data: 'eJwDAAAAAAE=' }),
    ).rejects.toThrow('A still image in the file does not have the stated size');
  });
});
