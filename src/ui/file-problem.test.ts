import { describe, expect, it } from 'vitest';

import { readProblem, writeProblem } from './file-problem';

// The error the browser throws under this name.
function thrown(name: string): DOMException {
  return new DOMException('The text of the browser.', name);
}

const NAMES = [
  'NotAllowedError',
  'SecurityError',
  'NoModificationAllowedError',
  'InvalidStateError',
  'QuotaExceededError',
  'NotReadableError',
  'NotFoundError',
  'UnknownError',
];

describe('readProblem', () => {
  it('names a refused access and a file in use, and otherwise a file that cannot be read', () => {
    expect(NAMES.map((name) => readProblem(thrown(name)))).toEqual([
      'accessDenied',
      'accessDenied',
      'fileInUse',
      'fileInUse',
      'unreadable',
      'unreadable',
      'unreadable',
      'unreadable',
    ]);
    expect(readProblem('NotAllowedError')).toBe('unreadable');
  });
});

describe('writeProblem', () => {
  it('names what the user can act on, a file that went away as one that cannot be reached', () => {
    expect(NAMES.map((name) => writeProblem(thrown(name)))).toEqual([
      'accessDenied',
      'accessDenied',
      'fileInUse',
      'fileInUse',
      'noSpace',
      'unreachable',
      'unreachable',
      null,
    ]);
    // What is no error at all names nothing either.
    expect(writeProblem('NotAllowedError')).toBeNull();
  });
});
