import { describe, expect, it } from 'vitest';

import { rovingTarget } from './roving';

const COUNT = 3;

describe('rovingTarget', () => {
  it('moves to the next and the previous choice and wraps around', () => {
    expect(rovingTarget('ArrowRight', 0, COUNT, false)).toBe(1);
    expect(rovingTarget('ArrowRight', 2, COUNT, false)).toBe(0);
    expect(rovingTarget('ArrowLeft', 0, COUNT, false)).toBe(2);
    expect(rovingTarget('ArrowLeft', 2, COUNT, false)).toBe(1);
  });

  it('jumps to the first and the last choice', () => {
    expect(rovingTarget('Home', 2, COUNT, false)).toBe(0);
    expect(rovingTarget('End', 0, COUNT, false)).toBe(2);
  });

  it('moves with up and down only where the row allows it', () => {
    expect(rovingTarget('ArrowDown', 0, COUNT, true)).toBe(1);
    expect(rovingTarget('ArrowUp', 0, COUNT, true)).toBe(2);
    expect(rovingTarget('ArrowDown', 0, COUNT, false)).toBeNull();
    expect(rovingTarget('ArrowUp', 0, COUNT, false)).toBeNull();
  });

  it('ignores other keys', () => {
    expect(rovingTarget('Enter', 0, COUNT, true)).toBeNull();
  });
});
