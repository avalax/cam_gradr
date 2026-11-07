import type * as LutModule from '../lut/lut';

// The LUT module with a memory: each correction model is baked into a LUT of a size only once per
// test file, because a 33³ LUT takes about 100 ms (several times that under coverage) and every
// mount of the preview bakes it again. The same model gives the same LUT object; a copy of a model
// is baked anew. Test files replace the module with it:
//   const { lutOnce } = await vi.hoisted(() => import('../test-support/lut-once'));
//   vi.mock(import('../lut/lut'), async (original) => lutOnce(await original()));
// This file imports only types from the LUT module, so the mock does not load itself.
export function lutOnce(lut: typeof LutModule): typeof LutModule {
  const baked = new WeakMap<object, Map<number, LutModule.Lut>>();
  return {
    ...lut,
    buildLut: (model, size) => {
      const sizes = baked.get(model) ?? new Map<number, LutModule.Lut>();
      baked.set(model, sizes);
      const known = sizes.get(size);
      if (known !== undefined) {
        return known;
      }
      const result = lut.buildLut(model, size);
      sizes.set(size, result);
      return result;
    },
  };
}
