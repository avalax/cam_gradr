import { i18n } from './index';

// Formats a number with a fixed number of decimals in the current language ("5.1" or "5,1").
export function formatDecimal(value: number, digits = 1): string {
  return new Intl.NumberFormat(i18n.global.locale.value, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

// Formats a number with an explicit sign ("+3" or "−3", with the minus sign U+2212).
export function formatSigned(value: number, digits = 0): string {
  const text = formatDecimal(Math.abs(value), digits);
  return `${value >= 0 ? '+' : '−'}${text}`;
}
