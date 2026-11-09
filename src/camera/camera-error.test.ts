import { describe, expect, it } from 'vitest';

import { CameraError, toCameraError } from './camera-error';

function named(name: string): Error {
  return new DOMException('x', name);
}

describe('toCameraError', () => {
  it.each([
    ['NotAllowedError', 'permissionDenied'],
    ['SecurityError', 'permissionDenied'],
    ['NotFoundError', 'notFound'],
    ['NotReadableError', 'inUse'],
    ['AbortError', 'inUse'],
    ['OverconstrainedError', 'unsatisfiable'],
    ['ConstraintNotSatisfiedError', 'unsatisfiable'],
    ['SomethingElse', 'unknown'],
  ] as const)('maps %s to the code %s', (name, code) => {
    const error = toCameraError(named(name));
    expect(error).toBeInstanceOf(CameraError);
    expect(error.code).toBe(code);
  });

  it('returns existing CameraErrors unchanged', () => {
    const original = new CameraError('unsupported');
    expect(toCameraError(original)).toBe(original);
  });

  it('treats non-Error values as unknown', () => {
    const error = toCameraError('kaputt');
    expect(error.code).toBe('unknown');
    expect(error.cause).toBe('kaputt');
  });
});
