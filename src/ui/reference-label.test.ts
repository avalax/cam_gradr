import { describe, expect, it } from 'vitest';

import { i18n } from '../lang';
import { BUNDLED_NAME } from '../reference/bundled';

import { fittedReferenceLabel, referenceLabel } from './reference-label';

describe('referenceLabel', () => {
  it('names the bundled set in the language of the app and every other set as it is', () => {
    expect(referenceLabel(BUNDLED_NAME)).toBe('Spyder Checkr 48 (inoffizielle Transkription)');
    expect(referenceLabel('Mein Satz')).toBe('Mein Satz');
    i18n.global.locale.value = 'en';
    expect(referenceLabel(BUNDLED_NAME)).toBe('Spyder Checkr 48 (unofficial transcription)');
  });
});

describe('fittedReferenceLabel', () => {
  const sets = [{ name: BUNDLED_NAME }, { name: 'Mein Satz' }];

  it('marks the set of a correction while the browser does not have it', () => {
    expect(fittedReferenceLabel('Mein Satz', sets)).toBe('Mein Satz');
    expect(fittedReferenceLabel('Fehlender Satz', sets)).toBe('Fehlender Satz (fehlt)');
    expect(fittedReferenceLabel(null, sets)).toBe('–');
  });
});
