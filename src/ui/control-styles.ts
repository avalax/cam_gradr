// Class lists of the plain controls, so that every text button and every link looks and reacts the
// same. Hover only changes the surface or the underline, so that the hover of a light and a dark
// appearance needs no variant of its own.

// A secondary text button (save, load, import, download a set): a white surface with a dark edge.
export const TEXT_BUTTON =
  'cursor-pointer rounded border border-zinc-800 bg-white px-3 py-1 text-sm hover:bg-zinc-200 dark:bg-zinc-100';

// A button or link inside a sentence (go to a tab, undo, a source).
export const LINK_BUTTON = 'cursor-pointer underline underline-offset-2 hover:decoration-2';

// A select (camera, reference set).
export const SELECT = 'rounded-md border border-zinc-400 bg-white p-1.5 dark:bg-zinc-100';
