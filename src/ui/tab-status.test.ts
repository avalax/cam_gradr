import { describe, expect, it } from 'vitest';

import type { ExposureResult } from '../chart/exposure';

import { colorStatus, grayStatus } from './tab-status';

function exposure(overrides: Partial<ExposureResult>): ExposureResult {
  return {
    verdict: 'ok',
    highlightsClipped: false,
    shadowsCrushed: false,
    level18: 0.46,
    level50: 0.74,
    delta: 0,
    contrast: 0,
    ...overrides,
  };
}

describe('grayStatus', () => {
  it('ist offen ohne Messung', () => {
    expect(grayStatus(null)).toEqual({ level: 'off', fill: 0, text: 'Noch nicht gemessen' });
  });

  it('ist grün im Normalbereich', () => {
    expect(grayStatus(exposure({}))).toEqual({ level: 'ok', fill: 4, text: 'Licht passt' });
  });

  it('warnt mit dem wichtigsten Hinweis, wenn das Licht nicht passt', () => {
    const status = grayStatus(exposure({ verdict: 'too-dark', delta: -0.2 }));
    expect(status.level).toBe('warn');
    expect(status.fill).toBe(2);
    expect(status.text).toBe('Helligkeit zu niedrig');
  });

  it('warnt auch dann, wenn es keinen einzelnen Hinweis gibt', () => {
    const status = grayStatus(exposure({ verdict: 'too-bright' }));
    expect(status).toEqual({ level: 'warn', fill: 2, text: 'Licht prüfen' });
  });
});

describe('colorStatus', () => {
  it('ist offen, solange nichts berechnet ist', () => {
    expect(colorStatus(null)).toEqual({ level: 'off', fill: 0, text: 'Noch nicht berechnet' });
  });

  it('ist grün bis zu einer mittleren Abweichung von 2', () => {
    expect(colorStatus({ meanBefore: 5.1, meanAfter: 0.4 })).toEqual({
      level: 'ok',
      fill: 4,
      text: 'Ø 5,1 → 0,4',
    });
    expect(colorStatus({ meanBefore: 9, meanAfter: 2 }).level).toBe('ok');
  });

  it('warnt darüber, stärker über 5', () => {
    expect(colorStatus({ meanBefore: 9, meanAfter: 3.5 })).toEqual({
      level: 'warn',
      fill: 3,
      text: 'Ø 9,0 → 3,5',
    });
    expect(colorStatus({ meanBefore: 20.2, meanAfter: 8 })).toEqual({
      level: 'warn',
      fill: 2,
      text: 'Ø 20,2 → 8,0',
    });
  });
});
