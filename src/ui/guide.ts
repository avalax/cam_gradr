import type { Corners } from '../chart/types';

// Guide frame in the live image: shows where to hold the cards (dark card frame).
// Dimensions from a photo of the opened case: portrait, width to height about 0.63.
const HEIGHT_SHARE = 0.81;
const ASPECT = 0.63;
// Card centers in the image (fraction of the width): this is where they lie in the unfolded case when
// it is held filling the frame; only the hinge remains between the cards.
const FIRST_CENTRE = 0.34;
const CENTRE_SPACING = 0.36;

// Corners of the frames for `count` cards, from left to right (top left, top right, bottom right,
// unten links).
export function guideCorners(size: { width: number; height: number }, count: number): Corners[] {
  const height = size.height * HEIGHT_SHARE;
  const width = height * ASPECT;
  const top = (size.height - height) / 2;
  return Array.from({ length: count }, (_, index) => {
    const centre = size.width * (FIRST_CENTRE + CENTRE_SPACING * index);
    const left = centre - width / 2;
    return [
      { x: left, y: top },
      { x: left + width, y: top },
      { x: left + width, y: top + height },
      { x: left, y: top + height },
    ];
  });
}
