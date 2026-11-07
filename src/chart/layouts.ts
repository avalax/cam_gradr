// With the import attribute Node loads these files too: the acceptance tests import the LUT, whose
// fit needs the neutral patches.
import colorLayoutJson from '../data/layouts/spyder-checkr-photo-color.layout.json' with { type: 'json' };
import grayLayoutJson from '../data/layouts/spyder-checkr-photo-gray.layout.json' with { type: 'json' };

import { parseLayout } from './layout';
import type { ChartLayout } from './types';

// The cards of a layout are listed from left to right, as they sit in the case.
export const grayLayout = parseLayout(grayLayoutJson);
export const colorLayout = parseLayout(colorLayoutJson);

function patchIds(layout: ChartLayout): ReadonlySet<string> {
  return new Set(layout.cards.flatMap((card) => card.patches.map((patch) => patch.id)));
}

// All patch IDs of the gray and of the color cards, and the neutral patches (gray ladders) among
// the latter.
export const GRAY_IDS = patchIds(grayLayout);
export const COLOR_IDS = patchIds(colorLayout);

export const NEUTRAL_IDS: ReadonlySet<string> = new Set(
  colorLayout.cards.flatMap((card) =>
    card.patches.filter((patch) => patch.role === 'neutral').map((patch) => patch.id),
  ),
);
