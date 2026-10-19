/**
 * Indian Rupee (INR) Currency and Pay Rate Formatting Utilities for WorkMatch
 */

export function formatINR(amount: number | string | undefined | null): string {
  const num = Number(amount);
  if (isNaN(num)) return '₹0';

  const hasDecimals = num % 1 !== 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
    minimumFractionDigits: hasDecimals ? 2 : 0
  }).format(num);
}

/**
 * Formats a pay rate with its payment basis.
 * Examples:
 * - formatPayWithBasis(800, 'daily', 'per') -> "₹800 per day"
 * - formatPayWithBasis(150, 'hourly', 'per') -> "₹150 per hour"
 * - formatPayWithBasis(800, 'daily', 'slash') -> "₹800 / day"
 * - formatPayWithBasis(150, 'hourly', 'slash') -> "₹150 / hr"
 */
export function formatPayWithBasis(
  amount: number | string | undefined | null,
  basis?: string,
  mode: 'slash' | 'per' = 'slash'
): string {
  const formatted = formatINR(amount);
  if (!basis) return formatted;

  const b = basis.toLowerCase().trim();
  let unit = basis;
  if (b === 'hourly' || b === 'hour' || b === 'hr') {
    unit = mode === 'per' ? 'hour' : 'hr';
  } else if (b === 'daily' || b === 'day') {
    unit = 'day';
  } else if (b === 'weekly' || b === 'week') {
    unit = 'week';
  } else if (b === 'shift') {
    unit = 'shift';
  } else if (b === 'task') {
    unit = 'task';
  }

  return mode === 'per' ? `${formatted} per ${unit}` : `${formatted} / ${unit}`;
}
