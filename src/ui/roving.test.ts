import { describe, expect, it } from 'vitest';

import { rovingTarget } from './roving';

const ALL = [true, true, true];

describe('rovingTarget', () => {
  it('moves to the next and the previous choice and wraps around', () => {
    expect(rovingTarget('ArrowRight', 0, ALL, false)).toBe(1);
    expect(rovingTarget('ArrowRight', 2, ALL, false)).toBe(0);
    expect(rovingTarget('ArrowLeft', 0, ALL, false)).toBe(2);
    expect(rovingTarget('ArrowLeft', 2, ALL, false)).toBe(1);
  });

  it('jumps to the first and the last choice', () => {
    expect(rovingTarget('Home', 2, ALL, false)).toBe(0);
    expect(rovingTarget('End', 0, ALL, false)).toBe(2);
  });

  it('moves with up and down only where the row allows it', () => {
    expect(rovingTarget('ArrowDown', 0, ALL, true)).toBe(1);
    expect(rovingTarget('ArrowUp', 0, ALL, true)).toBe(2);
    expect(rovingTarget('ArrowDown', 0, ALL, false)).toBeNull();
    expect(rovingTarget('ArrowUp', 0, ALL, false)).toBeNull();
  });

  it('skips choices that are not enabled', () => {
    const middleOff = [true, false, true];
    expect(rovingTarget('ArrowRight', 0, middleOff, true)).toBe(2);
    expect(rovingTarget('ArrowLeft', 2, middleOff, true)).toBe(0);
    expect(rovingTarget('Home', 2, [false, true, true], true)).toBe(1);
    expect(rovingTarget('End', 0, [true, true, false], true)).toBe(1);
  });

  it('ignores other keys and rows without an enabled choice', () => {
    expect(rovingTarget('Enter', 0, ALL, true)).toBeNull();
    expect(rovingTarget('ArrowRight', 0, [false, false], true)).toBeNull();
  });
});
