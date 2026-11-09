// What went wrong with the camera: the key of its text in the language files (camera.errors),
// which is translated when shown, so that it follows a language switch.
export type CameraErrorCode =
  | 'unsupported'
  | 'permissionDenied'
  | 'notFound'
  | 'inUse'
  | 'unsatisfiable'
  | 'unknown'
  | 'notReady'
  | 'noCanvas'
  | 'captureFailed';

export class CameraError extends Error {
  readonly code: CameraErrorCode;

  constructor(code: CameraErrorCode, options?: ErrorOptions) {
    super(code, options);
    this.name = 'CameraError';
    this.code = code;
  }
}

const NAME_TO_CODE: Readonly<Record<string, CameraErrorCode>> = {
  NotAllowedError: 'permissionDenied',
  SecurityError: 'permissionDenied',
  NotFoundError: 'notFound',
  NotReadableError: 'inUse',
  AbortError: 'inUse',
  OverconstrainedError: 'unsatisfiable',
  ConstraintNotSatisfiedError: 'unsatisfiable',
};

export function toCameraError(error: unknown): CameraError {
  if (error instanceof CameraError) {
    return error;
  }
  const name = error instanceof Error ? error.name : '';
  return new CameraError(NAME_TO_CODE[name] ?? 'unknown', { cause: error });
}
