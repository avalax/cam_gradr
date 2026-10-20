import { describe, expect, it } from 'vitest';

import { formatDecimal, formatSigned } from './format';

import { setLocale } from './index';

describe('formatDecimal', () => {
  it('uses the decimal separator of the language', () => {
    expect(formatDecimal(5.14)).toBe('5,1');
    setLocale('en');
    expect(formatDecimal(5.14)).toBe('5.1');
  });

  it('supports a configurable number of decimals', () => {
    expect(formatDecimal(0.5, 0)).toBe('1');
    expect(formatDecimal(2, 2)).toBe('2,00');
  });
});

describe('formatSigned', () => {
  it('adds a sign, using the real minus sign for negative values', () => {
    expect(formatSigned(3)).toBe('+3');
    expect(formatSigned(-3)).toBe('−3');
    expect(formatSigned(0)).toBe('+0');
  });

  it('formats decimals in the language', () => {
    expect(formatSigned(1.5, 1)).toBe('+1,5');
    setLocale('en');
    expect(formatSigned(-1.5, 1)).toBe('−1.5');
  });
});
