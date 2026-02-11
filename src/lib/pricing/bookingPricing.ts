/**
 * Booking pricing (business rules) layer.
 *
 * Uses the deterministic math engine in `priceEngine.ts` and applies:
 * - passenger age multipliers
 * - volatility buffer
 * - payment gateway fees
 *
 * IMPORTANT: This module is backend source-of-truth. Do not calculate totals in the frontend.
 */

import { priceEngine, type PriceBreakdown, type FeePolicy } from "./priceEngine";
import { passengerTypeFromDobIso } from "./passengerRules";

export type PaymentGateway = "stripe" | "paypal";

export interface PassengerInput {
  /** Passenger date of birth, expected as ISO date-only: "YYYY-MM-DD". */
  date_of_birth: string;
}

/* ───────────────────── business constants ───────────────────── */

/**
 * Age multipliers (business rule):
 * - Infant (0-2): 50% of base
 * - Child/Adult (>2): 100% of base
 */
export const AGE_MULTIPLIERS: Readonly<Record<"infant" | "adult", number>> = {
  infant: 0.5,
  adult: 1.0,
} as const;

/** Volatility buffer: +3% to cover FX fluctuations. */
export const VOLATILITY_BUFFER_PERCENT = 3;

/**
 * Gateway fees (USD):
 * - Stripe: 2.9% + $0.30
 * - PayPal: 3.49% + $0.49
 */
export const GATEWAY_FEE_POLICY: Readonly<Record<PaymentGateway, FeePolicy>> = {
  stripe: { type: "mixed", percentage: 2.9, fixed_amount: 0.3 },
  paypal: { type: "mixed", percentage: 3.49, fixed_amount: 0.49 },
} as const;

function assertFiniteNonNegative(name: string, value: number): void {
  if (!Number.isFinite(value)) throw new Error(`${name} must be a finite number`);
  if (value < 0) throw new Error(`${name} must be >= 0`);
}

/**
 * Calculates the final amount to charge for a booking.
 *
 * @param basePrice Base price per ADULT passenger, in major units (e.g. 199.99)
 * @param passengers Passengers (DOB-based classification happens in backend)
 * @param gateway Payment gateway to apply fee policy (stripe/paypal)
 */
export function calculateBookingTotal(
  basePrice: number,
  passengers: ReadonlyArray<PassengerInput>,
  gateway: PaymentGateway
): PriceBreakdown {
  assertFiniteNonNegative("basePrice", basePrice);
  if (passengers.length === 0) throw new Error("passengers must not be empty");

  const passengerSubtotal = passengers.reduce((sum, p, idx) => {
    const passengerType = passengerTypeFromDobIso(p.date_of_birth);
    const multiplier = AGE_MULTIPLIERS[passengerType];
    const line = basePrice * multiplier;
    assertFiniteNonNegative(`passengers[${idx}] line price`, line);
    return sum + line;
  }, 0);

  return priceEngine({
    base: { amount: passengerSubtotal, currency: "USD" },
    markup: { type: "none" },
    volatility_buffer: { type: "percentage", percentage: VOLATILITY_BUFFER_PERCENT },
    gateway_fee: GATEWAY_FEE_POLICY[gateway],
    gateway_fee_base: "pre_fee_total",
  });
}
