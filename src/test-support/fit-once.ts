import type * as Fit from '../solve/fit';

// The fit module with a memory: each input is fitted only once per test file, because a full fit
// takes about 100 ms and stores and components fit the same measurements again and again. Equal
// inputs give the same result object. Test files replace the module with it:
//   const { fitOnce } = await vi.hoisted(() => import('../test-support/fit-once'));
//   vi.mock(import('../solve/fit'), async (original) => fitOnce(await original()));
// This file imports only types from the fit module, so the mock does not load itself.
export function fitOnce(fit: typeof Fit): typeof Fit {
  const results = new Map<string, Fit.FitResult>();
  return {
    ...fit,
    fitColorModel: (input) => {
      const key = JSON.stringify(input);
      const known = results.get(key);
      if (known !== undefined) {
        return known;
      }
      const result = fit.fitColorModel(input);
      results.set(key, result);
      return result;
    },
  };
}
