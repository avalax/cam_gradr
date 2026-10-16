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

const MESSAGES: Readonly<Record<CameraErrorCode, string>> = {
  unsupported:
    'Kamerazugriff wird nicht unterstützt. Bitte einen aktuellen Browser über HTTPS oder localhost verwenden.',
  'permission-denied':
    'Der Zugriff auf die Kamera wurde verweigert. Bitte die Berechtigung im Browser erlauben.',
  'not-found': 'Es wurde keine Kamera gefunden.',
  'in-use': 'Die Kamera wird bereits von einer anderen Anwendung verwendet oder ist nicht lesbar.',
  unsatisfiable: 'Die gewählte Kamera unterstützt die gewünschte Auflösung nicht.',
  unknown: 'Die Kamera konnte nicht gestartet werden.',
};

export function toCameraError(error: unknown): CameraError {
  if (error instanceof CameraError) {
    return error;
  }
  const name = error instanceof Error ? error.name : '';
  return new CameraError(NAME_TO_CODE[name] ?? 'unknown', { cause: error });
}

export function describeCameraError(error: CameraError): string {
  return MESSAGES[error.code];
}
