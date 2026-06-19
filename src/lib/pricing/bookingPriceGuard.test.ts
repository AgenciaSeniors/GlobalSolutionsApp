import { describe, it, expect } from 'vitest';
import { computeAmountFloor, FLOOR_TOLERANCE } from './bookingPriceGuard';

// Reference "now" so age classification is deterministic.
const TODAY = new Date();
function dobForAge(years: number): string {
  const d = new Date(Date.UTC(TODAY.getUTCFullYear() - years, TODAY.getUTCMonth(), TODAY.getUTCDate()));
  return d.toISOString().slice(0, 10);
}

describe('computeAmountFloor', () => {
  it('sums full fare for adults', () => {
    expect(computeAmountFloor(100, [dobForAge(30), dobForAge(40)])).toBe(200);
  });

  it('applies child (75%) and infant (10%) multipliers', () => {
    // adult 100 + child 75 + infant 10 = 185
    expect(computeAmountFloor(100, [dobForAge(30), dobForAge(8), dobForAge(1)])).toBe(185);
  });

  it('treats an empty passenger list as a single adult-equivalent', () => {
    expect(computeAmountFloor(150, [])).toBe(150);
  });

  it('treats invalid DOB as adult (no undercharge)', () => {
    expect(computeAmountFloor(100, ['not-a-date'])).toBe(100);
  });

  it('returns 0 for a non-positive or invalid base', () => {
    expect(computeAmountFloor(0, [dobForAge(30)])).toBe(0);
    expect(computeAmountFloor(-50, [dobForAge(30)])).toBe(0);
    expect(computeAmountFloor(Number.NaN, [dobForAge(30)])).toBe(0);
  });

  it('a legitimate total (subtotal + buffer + fee) clears the floor with tolerance', () => {
    const floor = computeAmountFloor(199.99, [dobForAge(30), dobForAge(30)]);
    const legitTotal = Math.round(floor * 1.03 * 1.029 * 100) / 100; // +3% buffer, +2.9% gateway
    expect(legitTotal).toBeGreaterThanOrEqual(floor - FLOOR_TOLERANCE);
  });

  it('a tampered $1 total falls below the floor', () => {
    const floor = computeAmountFloor(199.99, [dobForAge(30)]);
    expect(1).toBeLessThan(floor - FLOOR_TOLERANCE);
  });
});
