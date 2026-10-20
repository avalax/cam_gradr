// Height (in rem) of everything except the image: page header and spacing. Gray cards, color
// cards and preview share the same value so the image is the same size and in the same place
// on every page.
const IMAGE_CHROME_REM = 12;

// Maximum image width: it should fit on one screen with everything around it
// (width = height × aspect ratio).
export function imageMaxWidth(aspect: number): string {
  return `calc((100vh - ${String(IMAGE_CHROME_REM)}rem) * ${String(aspect)})`;
}
