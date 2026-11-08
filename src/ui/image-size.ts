import type { Stills } from '../camera/camera-store';
import type { Resolution } from '../camera/types';

// Height (in rem) of everything except the image: page header and spacing, and the look bar with
// its two lines of messages under the image of the preview. Gray cards, color cards and preview share
// the same value so the image is the same size and in the same place on every page, and the preview
// fits the window with its look bar; on a short window the image of every tab gets smaller.
const PAGE_CHROME_REM = 12;
const LOOK_BAR_REM = 5.25;
const IMAGE_CHROME_REM = PAGE_CHROME_REM + LOOK_BAR_REM;

// Maximum image width: it should fit on one screen with everything around it
// (width = height × aspect ratio).
export function imageMaxWidth(aspect: number): string {
  return `calc((100vh - ${String(IMAGE_CHROME_REM)}rem) * ${String(aspect)})`;
}

// The frame of the image area on the tabs with a camera image, and of its invisible copy that gives
// the export the same height. In the dark appearance the image lies on its own surface with an
// edge; the band above the image sits flush at its top, as the bands of the side columns do.
export const IMAGE_BLOCK =
  'min-w-0 flex-1 dark:rounded-lg dark:border dark:border-zinc-400 dark:bg-zinc-100 dark:px-2.5 dark:pb-2.5';

// The band above the image: its corners follow the edge of the dark surface.
export const IMAGE_BAND = 'rounded-t dark:rounded-t-[7px]';

// Aspect ratio of the image area while there is no image to take it from.
const DEFAULT_ASPECT = 16 / 9;

// What the preview shows, worked out without the preview (the export takes its height from it). It
// has an image with a correction and a source: the live image, its own still image or, while the
// camera is off, the one of the color cards; that image also gives the aspect ratio.
export function previewImage(input: {
  corrected: boolean;
  live: boolean;
  stills: Stills;
  actual: Resolution | null;
}): { shown: boolean; aspect: number } {
  const source = input.live ? input.actual : (input.stills.preview ?? input.stills.color ?? null);
  return {
    shown: input.corrected && source !== null,
    aspect: source === null ? DEFAULT_ASPECT : source.width / source.height,
  };
}
