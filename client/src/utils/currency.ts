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
 * - formatPayWithBasis(800, 'shift', 'slash') -> "₹800 / shift"
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

/**
 * Calculates total estimated shift payment correctly based on payment basis:
 * - 'hourly' (or default): hourly rate × shift duration
 * - 'shift', 'daily', 'task': flat rate (does NOT multiply by hours)
 */
export function calculateShiftTotal(
  grossPay: number | string | undefined | null,
  payBasis: string | undefined | null,
  totalHours: number | string | undefined | null = 1
): number {
  const pay = Number(grossPay);
  if (isNaN(pay) || pay <= 0) return 0;

  const basis = (payBasis || 'hourly').toLowerCase().trim();

  // Per-shift, daily, or task payment is a flat amount
  if (basis === 'shift' || basis === 'daily' || basis === 'day' || basis === 'task' || basis === 'weekly') {
    return pay;
  }

  // Hourly payment is multiplied by shift duration (minimum 0 hours)
  const hours = Number(totalHours);
  const effectiveHours = !isNaN(hours) && hours > 0 ? hours : 1;
  return Math.round(pay * effectiveHours * 100) / 100;
}

/**
 * Formats the total estimated shift payment with appropriate duration or flat context
 * Examples:
 * - Hourly: "₹5,600 (7 hrs)"
 * - Per-shift: "₹800 (flat / shift)"
 * - Daily: "₹800 (flat / day)"
 */
export function formatEstimatedTotal(
  grossPay: number | string | undefined | null,
  payBasis: string | undefined | null,
  totalHours: number | string | undefined | null = 1
): string {
  const total = calculateShiftTotal(grossPay, payBasis, totalHours);
  const basis = (payBasis || 'hourly').toLowerCase().trim();
  const hours = Number(totalHours) || 0;

  if (basis === 'shift') {
    return `${formatINR(total)} (flat / shift)`;
  }
  if (basis === 'daily' || basis === 'day') {
    return `${formatINR(total)} (flat / day)`;
  }
  if (basis === 'task') {
    return `${formatINR(total)} (flat / task)`;
  }

  return `${formatINR(total)} (${hours} hrs)`;
}

/**
 * Pluralizes the open positions counter properly:
 * - formatOpenPositions(0) -> "Showing 0 open positions"
 * - formatOpenPositions(1) -> "Showing 1 open position"
 * - formatOpenPositions(2) -> "Showing 2 open positions"
 * - formatOpenPositions(15) -> "Showing 15 open positions"
 */
export function formatOpenPositions(count: number): string {
  const safeCount = Math.max(0, Number(count) || 0);
  return `Showing ${safeCount} open ${safeCount === 1 ? 'position' : 'positions'}`;
}
