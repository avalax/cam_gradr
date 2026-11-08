// Keyboard navigation in a row of choices (WAI-ARIA tabs and radio groups): the row is one stop of the
// Tab key, the arrow keys move within it and wrap around, Home and End jump to the first and the last
// choice. Left and right always move; up and down only where `vertical` says so (radio groups), so
// that they keep scrolling the page on the tabs. Choices that are not enabled are skipped. Returns the
// index to move to, or null for any other key or when no choice is enabled.
const STEPS: Readonly<Record<string, 1 | -1>> = {
  ArrowRight: 1,
  ArrowLeft: -1,
  ArrowDown: 1,
  ArrowUp: -1,
  Home: 1,
  End: -1,
};
const VERTICAL = new Set(['ArrowDown', 'ArrowUp']);

export function rovingTarget(
  key: string,
  index: number,
  enabled: readonly boolean[],
  vertical: boolean,
): number | null {
  const step = STEPS[key];
  if (step === undefined || (!vertical && VERTICAL.has(key))) {
    return null;
  }
  const count = enabled.length;
  // Home starts before the first choice, End after the last one, so that the step lands on them.
  let next = key === 'Home' ? -1 : key === 'End' ? count : index;
  for (let tries = 0; tries < count; tries += 1) {
    next = (next + step + count) % count;
    if (enabled[next] === true) {
      return next;
    }
  }
  return null;
}
