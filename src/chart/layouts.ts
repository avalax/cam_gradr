import colorLayoutJson from '../data/layouts/spyder-checkr-photo-color.layout.json';
import grayLayoutJson from '../data/layouts/spyder-checkr-photo-gray.layout.json';

import { parseLayout } from './layout';

export const grayLayout = parseLayout(grayLayoutJson);
export const colorLayout = parseLayout(colorLayoutJson);

// Alle Feld-IDs der Farbkarten und die Neutralfelder (Grauleitern) darunter.
export const COLOR_IDS: ReadonlySet<string> = new Set(
  colorLayout.cards.flatMap((card) => card.patches.map((patch) => patch.id)),
);

export const NEUTRAL_IDS: ReadonlySet<string> = new Set(
  colorLayout.cards.flatMap((card) =>
    card.patches.filter((patch) => patch.role === 'neutral').map((patch) => patch.id),
  ),
);
