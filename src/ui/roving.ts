// Keyboard navigation in a row of choices (WAI-ARIA tabs and radio groups): the row is one stop of the
// Tab key, the arrow keys move within it and wrap around, Home and End jump to the first and the last
// choice. Left and right always move; up and down only where `vertical` says so (radio groups), so
// that they keep scrolling the page on the tabs. Returns the index to move to, or null for any other
// key.
const STEPS: Readonly<Record<string, 1 | -1>> = {
  ArrowRight: 1,
  ArrowLeft: -1,
  ArrowDown: 1,
  ArrowUp: -1,
};
const VERTICAL = new Set(['ArrowDown', 'ArrowUp']);

export function rovingTarget(
  key: string,
  index: number,
  count: number,
  vertical: boolean,
): number | null {
  if (key === 'Home') {
    return 0;
  }
  if (key === 'End') {
    return count - 1;
  }
  const step = STEPS[key];
  if (step === undefined || (!vertical && VERTICAL.has(key))) {
    return null;
  }
  return (index + step + count) % count;
}
