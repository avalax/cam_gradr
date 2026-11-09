import { watch } from 'vue';
import type { WatchStopHandle } from 'vue';

import { useColorChartStore } from '../chart/chart-store';
import { useReferenceStore } from '../reference/reference-store';

import { useSolveStore } from './solve-store';

// The correction follows the measurements of the color cards and the selected reference set,
// whichever tab is open: choosing or importing a set in the settings recomputes it everywhere, also
// for a project without still images, whose color cards have measurements but no corner points. The
// solve store then names the set it was computed with.
export function recomputeOnChange(): WatchStopHandle {
  const chart = useColorChartStore();
  const references = useReferenceStore();
  const solve = useSolveStore();
  return watch(
    [() => chart.measurements, () => references.selected],
    ([measurements, reference]) => {
      if (reference !== null && Object.keys(measurements).length > 0) {
        solve.compute({ measurements, reference });
      }
    },
  );
}
