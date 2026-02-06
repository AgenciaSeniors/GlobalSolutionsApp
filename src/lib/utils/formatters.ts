/**
 * @fileoverview Locale-aware formatting helpers for currency, dates and durations.
 * @module lib/utils/formatters
 */

/**
 * Format a number as USD currency.
 * @example formatCurrency(1250) → "$1,250.00"
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

/**
 * Format an ISO date string to a human-readable date.
 * @example formatDate('2026-03-15') → "Mar 15, 2026"
 */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format an ISO datetime to a time string.
 * @example formatTime('2026-03-15T22:45:00Z') → "22:45"
 */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Calculate and format the duration between two ISO datetimes.
 * @example formatDuration('...T08:00Z','...T14:30Z') → "6h 30m"
 */
export function formatDuration(departure: string, arrival: string): string {
  const ms = new Date(arrival).getTime() - new Date(departure).getTime();
  const totalMinutes = Math.round(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
}

/**
 * Calculate percentage discount.
 */
export function calcDiscount(original: number, current: number): number {
  if (original <= 0) return 0;
  return Math.round(((original - current) / original) * 100);
}
