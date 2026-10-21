import type { Corners } from '../chart/types';

// Guide frame in the live image: shows position and direction of the cards, not a size to match
// (the cards are held where the subject will be, which is further away than the lens). Dimensions
// from a photo of the opened case: portrait, width to height about 0.63.
const HEIGHT_SHARE = 0.42;
const ASPECT = 0.63;
// Distance of the card centers in card widths: in the unfolded case only the hinge lies between them.
const CENTRE_SPACING = 1.26;

// Corners of the frames for `count` cards, from left to right (top left, top right, bottom right,
// bottom left), centered in the image as a group.
export function guideCorners(size: { width: number; height: number }, count: number): Corners[] {
  const height = size.height * HEIGHT_SHARE;
  const width = height * ASPECT;
  const top = (size.height - height) / 2;
  const spacing = width * CENTRE_SPACING;
  const first = (size.width - spacing * (count - 1)) / 2;
  return Array.from({ length: count }, (_, index) => {
    const left = first + spacing * index - width / 2;
    return [
      { x: left, y: top },
      { x: left + width, y: top },
      { x: left + width, y: top + height },
      { x: left, y: top + height },
    ];
  });
}
