import type { Stills } from '../camera/camera-store';
import type { Resolution } from '../camera/types';

// Height (in rem) of everything except the image: page header and spacing, and the look bar with
// its two lines of messages under the image of the preview. Gray cards, color cards and preview share
// the same value so the image is the same size and in the same place on every page, and the preview
// fits the window with its look bar; on a short window the image of every tab gets smaller.
const PAGE_CHROME_REM = 12;
const LOOK_BAR_REM = 5.25;
const IMAGE_CHROME_REM = PAGE_CHROME_REM + LOOK_BAR_REM;

// Width of the image: as wide as the height that fits on one screen with everything around it allows
// (width = height × aspect ratio). The image block takes it as its width with `max-w-full`, so that
// a narrow window still shrinks it to its track.
export function imageWidth(aspect: number): string {
  return `calc((100vh - ${String(IMAGE_CHROME_REM)}rem) * ${String(aspect)})`;
}

// The columns of a tab with a camera image: the image with its side column, then the text. The first
// column is as wide as the image row needs and no wider, so that on a wide but short window image,
// side column and text stay together and the free room collects at the right edge; on a narrow or
// tall window it shrinks to the room there is and the image fills its track.
export const TAB_COLUMNS =
  'lg:grid lg:grid-cols-[minmax(0,max-content)_21rem] lg:items-start lg:justify-start lg:gap-6';

// The frame of the image area on the tabs with a camera image, and of its invisible copy that gives
// the export the same height and width; its width is imageWidth. In the dark appearance the image
// lies on its own surface with an edge; the band above the image sits flush at its top, as the bands
// of the side columns do.
export const IMAGE_BLOCK =
  'min-w-0 max-w-full dark:rounded-lg dark:border dark:border-zinc-400 dark:bg-zinc-100 dark:px-2.5 dark:pb-2.5';

// The image and the narrow column beside it, as one grid on every tab with a camera image. The
// column follows the image right away: the row is as wide as the image (TAB_COLUMNS), and the export
// puts its project card at the same place.
export const IMAGE_ROW = 'grid grid-cols-[minmax(0,1fr)_11rem] items-stretch gap-x-3';

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
