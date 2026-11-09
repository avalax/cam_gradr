// With the import attribute Node loads these files too: the acceptance tests import the LUT, whose
// fit needs the neutral patches.
import colorLayoutJson from '../data/layouts/spyder-checkr-photo-color.layout.json' with { type: 'json' };
import grayLayoutJson from '../data/layouts/spyder-checkr-photo-gray.layout.json' with { type: 'json' };

import type { ChartLayout } from './types';

// The bundled layout files (format cam_gradr-layout/2) are part of the app and never come from the
// user: the tests check them thoroughly (layouts.test.ts), so the app takes them as they are. The
// cards of a layout are listed from left to right, as they sit in the case.
export const grayLayout = grayLayoutJson as ChartLayout;
export const colorLayout = colorLayoutJson as ChartLayout;

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
