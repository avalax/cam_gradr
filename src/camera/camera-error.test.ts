import { describe, expect, it } from 'vitest';

import { CameraError, describeCameraError, toCameraError } from './camera-error';

function named(name: string): Error {
  return new DOMException('x', name);
}

describe('toCameraError', () => {
  it.each([
    ['NotAllowedError', 'permission-denied'],
    ['SecurityError', 'permission-denied'],
    ['NotFoundError', 'not-found'],
    ['NotReadableError', 'in-use'],
    ['AbortError', 'in-use'],
    ['OverconstrainedError', 'unsatisfiable'],
    ['ConstraintNotSatisfiedError', 'unsatisfiable'],
    ['SomethingElse', 'unknown'],
  ] as const)('ordnet %s dem Code %s zu', (name, code) => {
    const error = toCameraError(named(name));
    expect(error).toBeInstanceOf(CameraError);
    expect(error.code).toBe(code);
  });

  it('gibt vorhandene CameraErrors unverändert zurück', () => {
    const original = new CameraError('unsupported');
    expect(toCameraError(original)).toBe(original);
  });

  it('behandelt Nicht-Error-Werte als unbekannt', () => {
    const error = toCameraError('kaputt');
    expect(error.code).toBe('unknown');
    expect(error.cause).toBe('kaputt');
  });
});

describe('describeCameraError', () => {
  it('liefert für jeden Code einen deutschen Text', () => {
    for (const code of [
      'unsupported',
      'permission-denied',
      'not-found',
      'in-use',
      'unsatisfiable',
      'unknown',
    ] as const) {
      expect(describeCameraError(new CameraError(code)).length).toBeGreaterThan(10);
    }
  });

  it('setzt Name und Code', () => {
    const error = new CameraError('not-found');
    expect(error.name).toBe('CameraError');
    expect(error.code).toBe('not-found');
  });
});
