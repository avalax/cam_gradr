import bundled from '../data/reference/spyder-checkr-48.reference.json';

import { parseReferenceData } from './reference';
import type { ReferenceSet } from './reference';

// Bundled reference set: an unofficial transcription, not a manufacturer file.
export const BUNDLED_NAME = bundled.name;
export const BUNDLED_SOURCE_URL = bundled.source;

export function bundledReference(): ReferenceSet {
  return parseReferenceData(bundled);
}
