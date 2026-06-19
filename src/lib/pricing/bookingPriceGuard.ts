/**
 * Booking amount integrity guard (server source-of-truth).
 *
 * The checkout flow runs in the browser and writes `bookings.total_amount`
 * directly. The DB trigger `enforce_booking_payment_guard` blocks *updates* to
 * payment fields by non-privileged users, but the *initial* total is still
 * client-supplied. This module recomputes an authoritative price *floor* from
 * the persisted flight(s) + the booking's passengers and is used at payment
 * confirmation to refuse implausibly low amounts (e.g. a tampered $1 total).
 *
 * Design choice: we compare against a conservative FLOOR (subtotal with age
 * multipliers, WITHOUT the volatility buffer or gateway fee). A legitimate
 * `total_amount` is always >= this floor, so the guard never produces false
 * positives for honest bookings, while still catching gross undercharging.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { passengerTypeFromDobIso, AGE_MULTIPLIERS } from './passengerRules';

/** Tolerance (USD) to absorb rounding when validating the booking amount floor. */
export const FLOOR_TOLERANCE = 0.5;

/**
 * Pure: minimum defensible booking amount given the authoritative per-adult
 * base fare and the passengers' dates of birth (infant 10%, child 75%,
 * adult 100%). With no passengers we assume a single adult-equivalent so a
 * zero-passenger booking can't slip a near-zero total through.
 */
export function computeAmountFloor(basePerAdult: number, dobList: string[]): number {
  if (!Number.isFinite(basePerAdult) || basePerAdult <= 0) return 0;
  const list = dobList.length > 0 ? dobList : [''];
  const sumMultipliers = list.reduce(
    (acc, dob) => acc + AGE_MULTIPLIERS[passengerTypeFromDobIso(dob)],
    0
  );
  return Math.round(basePerAdult * sumMultipliers * 100) / 100;
}

export interface AmountGuardResult {
  /** True when the amount is acceptable (or could not be determined). */
  ok: boolean;
  /** Whether an authoritative floor could actually be computed. */
  determined: boolean;
  floor: number;
  total: number;
  basePerAdult: number;
  passengers: number;
  reason?: string;
}

function pickFinalPrice(flightRel: unknown): number {
  if (Array.isArray(flightRel)) {
    const first = flightRel[0] as { final_price?: unknown } | undefined;
    return Number(first?.final_price ?? 0);
  }
  if (flightRel && typeof flightRel === 'object') {
    return Number((flightRel as { final_price?: unknown }).final_price ?? 0);
  }
  return 0;
}

/**
 * Verifies that `bookings.total_amount` is not implausibly below the authoritative
 * fare floor derived from the persisted flight(s) and the passengers on the
 * booking. Never blocks when the price source can't be determined (e.g. offer
 * bookings) — returns `{ ok: true, determined: false }` to avoid false positives.
 */
export async function checkBookingAmountFloor(
  supabaseAdmin: SupabaseClient,
  bookingId: string
): Promise<AmountGuardResult> {
  const empty = { floor: 0, basePerAdult: 0, passengers: 0 };

  const { data: booking } = await supabaseAdmin
    .from('bookings')
    .select('id, flight_id, offer_id, trip_type, total_amount')
    .eq('id', bookingId)
    .single();

  if (!booking) {
    return { ok: true, determined: false, total: 0, reason: 'booking_not_found', ...empty };
  }

  const total = Number(booking.total_amount);

  // Authoritative per-adult base fare from the DB (never from the client).
  let basePerAdult = 0;
  if (booking.flight_id) {
    const { data: f } = await supabaseAdmin
      .from('flights')
      .select('final_price')
      .eq('id', booking.flight_id)
      .single();
    basePerAdult = Number(f?.final_price ?? 0);
  } else if (String(booking.trip_type ?? '') === 'multicity') {
    const { data: legs } = await supabaseAdmin
      .from('booking_itineraries')
      .select('flight:flights(final_price)')
      .eq('booking_id', bookingId);
    basePerAdult = (legs ?? []).reduce(
      (acc, l) => acc + pickFinalPrice((l as { flight?: unknown }).flight),
      0
    );
  } else {
    // Offers / unknown pricing source — out of scope for this guard.
    return { ok: true, determined: false, total, reason: 'unsupported_pricing_source', ...empty };
  }

  if (!Number.isFinite(basePerAdult) || basePerAdult <= 0) {
    return { ok: true, determined: false, total, reason: 'base_unavailable', ...empty };
  }

  const { data: pax } = await supabaseAdmin
    .from('booking_passengers')
    .select('date_of_birth')
    .eq('booking_id', bookingId);

  const dobList = (pax ?? []).map((p) => String((p as { date_of_birth?: unknown }).date_of_birth ?? ''));
  const floor = computeAmountFloor(basePerAdult, dobList);
  const ok = Number.isFinite(total) && total >= floor - FLOOR_TOLERANCE;

  return {
    ok,
    determined: true,
    floor,
    total,
    basePerAdult,
    passengers: dobList.length,
    reason: ok ? undefined : 'amount_below_floor',
  };
}
