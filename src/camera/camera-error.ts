import { t } from '../lang';

export type CameraErrorCode =
  'unsupported' | 'permission-denied' | 'not-found' | 'in-use' | 'unsatisfiable' | 'unknown';

export class CameraError extends Error {
  readonly code: CameraErrorCode;

  constructor(code: CameraErrorCode, options?: ErrorOptions) {
    super(code, options);
    this.name = 'CameraError';
    this.code = code;
  }
}

const NAME_TO_CODE: Readonly<Record<string, CameraErrorCode>> = {
  NotAllowedError: 'permission-denied',
  SecurityError: 'permission-denied',
  NotFoundError: 'not-found',
  NotReadableError: 'in-use',
  AbortError: 'in-use',
  OverconstrainedError: 'unsatisfiable',
  ConstraintNotSatisfiedError: 'unsatisfiable',
};

// Each text is looked up when needed, so a language switch applies to the next error.
const MESSAGES: Readonly<Record<CameraErrorCode, () => string>> = {
  unsupported: () => t('camera.errors.unsupported'),
  'permission-denied': () => t('camera.errors.permissionDenied'),
  'not-found': () => t('camera.errors.notFound'),
  'in-use': () => t('camera.errors.inUse'),
  unsatisfiable: () => t('camera.errors.unsatisfiable'),
  unknown: () => t('camera.errors.unknown'),
};

export function toCameraError(error: unknown): CameraError {
  if (error instanceof CameraError) {
    return error;
  }
  const name = error instanceof Error ? error.name : '';
  return new CameraError(NAME_TO_CODE[name] ?? 'unknown', { cause: error });
}

export function describeCameraError(error: CameraError): string {
  return MESSAGES[error.code]();
}
