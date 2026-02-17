/**
 * Booking pricing (business rules) layer - Module 2: Financial Infrastructure.
 *
 * Uses the deterministic math engine in `priceEngine.ts` and applies:
 * - Passenger age multipliers (Infant: 10%, Child: 75%, Adult: 100%)
 * - Volatility buffer (3% to cover FX fluctuations)
 * - Payment gateway fees (Stripe: 2.9% + $0.30, PayPal: 3.49% + $0.49)
 *
 * IMPORTANT: This module is backend source-of-truth. 
 * Do NOT calculate totals in the frontend for security.
 */

import { priceEngine, type PriceBreakdown, type FeePolicy } from "./priceEngine";
import { passengerTypeFromDobIso, AGE_MULTIPLIERS, type PassengerType } from "./passengerRules";

export type PaymentGateway = "stripe" | "paypal";

export interface PassengerInput {
  /** Passenger date of birth, expected as ISO date-only: "YYYY-MM-DD". */
  date_of_birth: string;
}

/* ───────────────────── business constants ───────────────────── */

/**
 * Age multipliers (Module 2 spec):
 * - Infant (0-2 years): 10% of base fare
 * - Child (2-12 years): 75% of base fare
 * - Adult (>12 years): 100% of base fare
 */
export { AGE_MULTIPLIERS };

/** Volatility buffer: +3% to cover FX fluctuations and market volatility. */
export const VOLATILITY_BUFFER_PERCENT = 3;

/**
 * Gateway fees (USD) - Module 2 spec:
 * - Stripe: 2.9% + $0.30
 * - PayPal: 3.49% + $0.49
 */
export const GATEWAY_FEE_POLICY: Readonly<Record<PaymentGateway, FeePolicy>> = {
  stripe: { type: "mixed", percentage: 2.9, fixed_amount: 0.30 },
  paypal: { type: "mixed", percentage: 3.49, fixed_amount: 0.49 },
} as const;

function assertFiniteNonNegative(name: string, value: number): void {
  if (!Number.isFinite(value)) throw new Error(`${name} must be a finite number`);
  if (value < 0) throw new Error(`${name} must be >= 0`);
}

/**
 * Calculates the final amount to charge for a booking.
 *
 * Pricing breakdown:
 * 1. Base price per passenger with age multiplier applied
 * 2. Volatility buffer: 3% on subtotal
 * 3. Gateway fee: Applied to (subtotal + volatility buffer)
 * 
 * @param basePrice - Base price per adult passenger, in major units (e.g. 199.99)
 * @param passengers - Array of passengers with DOB for age classification
 * @param gateway - Payment gateway to apply fee policy ('stripe' | 'paypal')
 * @returns Complete price breakdown with all components
 */
export function calculateBookingTotal(
  basePrice: number,
  passengers: ReadonlyArray<PassengerInput>,
  gateway: PaymentGateway
): PriceBreakdown {
  assertFiniteNonNegative("basePrice", basePrice);
  if (passengers.length === 0) throw new Error("passengers must not be empty");

  // Calculate subtotal with age multipliers
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

/**
 * Get detailed passenger breakdown for transparency
 * 
 * @param basePrice - Base price per adult passenger
 * @param passengers - Array of passengers with DOB
 * @returns Array with individual passenger pricing details
 */
export function getPassengerPricingDetails(
  basePrice: number,
  passengers: ReadonlyArray<PassengerInput>
): Array<{
  index: number;
  date_of_birth: string;
  type: PassengerType;
  multiplier: number;
  price: number;
}> {
  assertFiniteNonNegative("basePrice", basePrice);
  
  return passengers.map((p, idx) => {
    const type = passengerTypeFromDobIso(p.date_of_birth);
    const multiplier = AGE_MULTIPLIERS[type];
    return {
      index: idx,
      date_of_birth: p.date_of_birth,
      type,
      multiplier,
      price: basePrice * multiplier,
    };
  });
}

/**
 * Compare pricing between different payment gateways
 * Useful for showing users the price difference
 * 
 * @param basePrice - Base price per adult passenger
 * @param passengers - Array of passengers with DOB
 * @returns Comparison of pricing for each gateway
 */
export function compareGatewayPricing(
  basePrice: number,
  passengers: ReadonlyArray<PassengerInput>
): {
  stripe: PriceBreakdown;
  paypal: PriceBreakdown;
  difference: number;
  savings_gateway: PaymentGateway | null;
} {
  const stripePricing = calculateBookingTotal(basePrice, passengers, "stripe");
  const paypalPricing = calculateBookingTotal(basePrice, passengers, "paypal");
  
  const difference = Math.abs(stripePricing.total_amount - paypalPricing.total_amount);
  const savings_gateway = stripePricing.total_amount < paypalPricing.total_amount 
    ? "stripe" 
    : paypalPricing.total_amount < stripePricing.total_amount 
      ? "paypal" 
      : null;
  
  return {
    stripe: stripePricing,
    paypal: paypalPricing,
    difference,
    savings_gateway,
  };
}

/**
 * Format price breakdown for display or storage
 * 
 * @param breakdown - PriceBreakdown from calculateBookingTotal
 * @returns Formatted object with currency strings
 */
export function formatPriceBreakdown(breakdown: PriceBreakdown): {
  currency: string;
  subtotal: string;
  volatility_buffer: string;
  gateway_fee: string;
  total: string;
  subtotal_cents: number;
  total_cents: number;
} {
  return {
    currency: breakdown.currency,
    subtotal: `$${breakdown.subtotal.toFixed(2)}`,
    volatility_buffer: `$${breakdown.volatility_buffer_amount.toFixed(2)}`,
    gateway_fee: `$${breakdown.gateway_fee_amount.toFixed(2)}`,
    total: `$${breakdown.total_amount.toFixed(2)}`,
    subtotal_cents: breakdown.cents.subtotal,
    total_cents: breakdown.cents.total_amount,
  };
}
