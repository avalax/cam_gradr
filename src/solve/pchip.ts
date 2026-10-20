// Monotone cubic interpolation (PCHIP, Fritsch-Carlson) through control points.
export interface Curve {
  xs: number[];
  ys: number[];
}

function endSlope(h0: number, h1: number, d0: number, d1: number): number {
  const slope = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1);
  if (Math.sign(slope) !== Math.sign(d0)) {
    return 0;
  }
  if (Math.sign(d0) !== Math.sign(d1) && Math.abs(slope) > 3 * Math.abs(d0)) {
    return 3 * d0;
  }
  return slope;
}

function slopes(xs: readonly number[], ys: readonly number[]): number[] {
  const count = xs.length;
  const h = Array.from({ length: count - 1 }, (_, k) => Number(xs[k + 1]) - Number(xs[k]));
  const d = h.map((width, k) => (Number(ys[k + 1]) - Number(ys[k])) / width);
  if (count === 2) {
    return [Number(d[0]), Number(d[0])];
  }
  const m = Array.from({ length: count }, () => 0);
  for (let k = 1; k < count - 1; k++) {
    const left = Number(d[k - 1]);
    const right = Number(d[k]);
    if (left * right > 0) {
      const w1 = 2 * Number(h[k]) + Number(h[k - 1]);
      const w2 = Number(h[k]) + 2 * Number(h[k - 1]);
      m[k] = (w1 + w2) / (w1 / left + w2 / right);
    }
  }
  m[0] = endSlope(Number(h[0]), Number(h[1]), Number(d[0]), Number(d[1]));
  m[count - 1] = endSlope(
    Number(h[count - 2]),
    Number(h[count - 3]),
    Number(d[count - 2]),
    Number(d[count - 3]),
  );
  return m;
}

// Creates an evaluation function. Outside the control points it continues linearly with the
// edge slope. xs must be strictly increasing, with at least two points.
export function createPchip(curve: Curve): (x: number) => number {
  const { xs, ys } = curve;
  if (xs.length < 2 || xs.length !== ys.length) {
    throw new RangeError('A curve needs at least two points');
  }
  if (xs.some((x, k) => k > 0 && x <= Number(xs[k - 1]))) {
    throw new RangeError('The x values must be strictly increasing');
  }
  const m = slopes(xs, ys);
  const last = xs.length - 1;
  return (x: number): number => {
    if (x <= Number(xs[0])) {
      return Number(ys[0]) + Number(m[0]) * (x - Number(xs[0]));
    }
    if (x >= Number(xs[last])) {
      return Number(ys[last]) + Number(m[last]) * (x - Number(xs[last]));
    }
    let k = 0;
    while (x > Number(xs[k + 1])) {
      k++;
    }
    const x0 = Number(xs[k]);
    const h = Number(xs[k + 1]) - x0;
    const t = (x - x0) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * Number(ys[k]) +
      (t3 - 2 * t2 + t) * h * Number(m[k]) +
      (-2 * t3 + 3 * t2) * Number(ys[k + 1]) +
      (t3 - t2) * h * Number(m[k + 1])
    );
  };
}
