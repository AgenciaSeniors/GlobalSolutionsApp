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
 * Map app language code to browser locale string.
 */
export function langToLocale(lang: string): string {
  return lang === 'en' ? 'en-US' : 'es-ES';
}

/**
 * Format an ISO date string to a human-readable date.
 * @param iso  ISO date or datetime string.
 * @param locale  BCP-47 locale string (default 'es-ES'). Pass langToLocale(language) from context.
 * @example formatDate('2026-03-15', 'en-US') → "Mar 15, 2026"
 */
export function formatDate(iso: string, locale: string = 'es-ES'): string {
  return new Date(iso).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format an ISO datetime to a time string.
 * @param iso  ISO datetime string.
 * @param locale  BCP-47 locale string (default 'es-ES').
 * @example formatTime('2026-03-15T22:45:00Z', 'en-US') → "10:45 PM"
 */
export function formatTime(iso: string, locale: string = 'es-ES'): string {
  return new Date(iso).toLocaleTimeString(locale, {
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
