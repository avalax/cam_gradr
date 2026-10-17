import bundled from '../data/reference/spyder-checkr-48.reference.json';

// Mitgelieferter Referenzsatz: eine inoffizielle Transkription, keine Herstellerdatei.
export const BUNDLED_FILE_NAME = 'spyder-checkr-48.reference.json';
export const BUNDLED_NAME = bundled.name;
export const BUNDLED_SOURCE_URL = bundled.source;

export function bundledReferenceText(): string {
  return JSON.stringify(bundled);
}
