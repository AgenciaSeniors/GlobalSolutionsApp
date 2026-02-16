/**
 * Refund Calculator - Module 2: Financial Infrastructure
 *
 * PURE FUNCTION: No DB calls, no side effects, no imports.
 * Works entirely in cents to avoid floating-point issues.
 *
 * Business Rules:
 *  1. Airline cancellation → 100% refund + $20 bonus
 *  2. Customer < 48h → 100% refund (minus gateway fee, which is non-refundable)
 *  3. Customer > 48h → 50% refund
 *
 * Gateway fees are NEVER refunded regardless of reason.
 */

/* ───────────────────── Types ───────────────────── */

export interface RefundInput {
  /** Total amount the customer paid (USD, major units) */
  totalPaid: number;
  /** Hours elapsed since the booking was paid */
  hoursSinceBooking: number;
  /** Whether the airline cancelled the flight (overrides customer rules) */
  isAirlineCancel: boolean;
  /** Gateway fee amount (USD, major units). Non-refundable. */
  gatewayFee?: number;
}

export interface RefundResult {
  /** Amount to refund to the customer (USD, major units) */
  refund_amount: number;
  /** Amount retained as penalty (USD, major units) */
  penalty_amount: number;
  /** Human-readable explanation of the retention/refund */
  retention_reason: string;
  /** Refund percentage applied (100 or 50) */
  refund_percentage: number;
  /** Bonus compensation for airline cancellation */
  compensation_bonus: number;
  /** Gateway fee that is not refunded */
  gateway_fee_retained: number;
  /** Cents breakdown for precision auditing */
  cents: {
    refund_amount: number;
    penalty_amount: number;
    compensation_bonus: number;
    gateway_fee_retained: number;
  };
}

/* ───────────────────── Constants ───────────────────── */

/** Airline cancel compensation bonus in dollars */
const AIRLINE_CANCEL_BONUS = 20.0;

/** Threshold hours for full refund eligibility */
const FULL_REFUND_HOURS = 48;

/* ───────────────────── Helpers ───────────────────── */

function toCents(amount: number): number {
  return Math.round(amount * 100);
}

function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

function assertNonNegative(name: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number, got: ${value}`);
  }
  if (value < 0) {
    throw new Error(`${name} must be >= 0, got: ${value}`);
  }
}

/* ───────────────────── Calculator ───────────────────── */

/**
 * Calculate refund amount based on business rules.
 *
 * @example
 * // Airline cancelled, customer paid $500 with $15 gateway fee
 * calculateRefundAmount({
 *   totalPaid: 500,
 *   hoursSinceBooking: 72,
 *   isAirlineCancel: true,
 *   gatewayFee: 15,
 * });
 * // → { refund_amount: 505, penalty_amount: 0, compensation_bonus: 20, ... }
 *
 * @example
 * // Customer cancel within 48h, $300 total, $9 gateway fee
 * calculateRefundAmount({
 *   totalPaid: 300,
 *   hoursSinceBooking: 24,
 *   isAirlineCancel: false,
 *   gatewayFee: 9,
 * });
 * // → { refund_amount: 291, penalty_amount: 0, gateway_fee_retained: 9, ... }
 */
export function calculateRefundAmount(input: RefundInput): RefundResult {
  const { totalPaid, hoursSinceBooking, isAirlineCancel, gatewayFee = 0 } = input;

  assertNonNegative("totalPaid", totalPaid);
  assertNonNegative("hoursSinceBooking", hoursSinceBooking);
  assertNonNegative("gatewayFee", gatewayFee);

  const totalPaidCents = toCents(totalPaid);
  const gatewayFeeCents = toCents(gatewayFee);

  // The refundable base is total minus gateway fee (gateway fees are NEVER refunded)
  const refundableBaseCents = totalPaidCents - gatewayFeeCents;

  let refundPercentage: number;
  let compensationBonusCents: number;
  let retentionReason: string;

  if (isAirlineCancel) {
    // ── Rule 1: Airline cancellation ──
    // 100% refund of refundable base + $20 bonus
    refundPercentage = 100;
    compensationBonusCents = toCents(AIRLINE_CANCEL_BONUS);
    retentionReason =
      "Full refund + $20.00 compensation (flight cancelled by airline). " +
      "Gateway processing fee is non-refundable.";
  } else if (hoursSinceBooking < FULL_REFUND_HOURS) {
    // ── Rule 2: Customer cancel < 48h ──
    // 100% refund of refundable base (gateway fee retained)
    refundPercentage = 100;
    compensationBonusCents = 0;
    retentionReason =
      `Full refund (cancelled within ${FULL_REFUND_HOURS}h of booking). ` +
      "Gateway processing fee is non-refundable.";
  } else {
    // ── Rule 3: Customer cancel > 48h ──
    // 50% refund of refundable base
    refundPercentage = 50;
    compensationBonusCents = 0;
    retentionReason =
      `Partial refund (50%) — cancelled after ${FULL_REFUND_HOURS}h. ` +
      "Gateway processing fee is non-refundable.";
  }

  const refundBaseCents = Math.round((refundableBaseCents * refundPercentage) / 100);
  const totalRefundCents = refundBaseCents + compensationBonusCents;
  const penaltyCents = refundableBaseCents - refundBaseCents;

  return {
    refund_amount: fromCents(totalRefundCents),
    penalty_amount: fromCents(penaltyCents),
    retention_reason: retentionReason,
    refund_percentage: refundPercentage,
    compensation_bonus: fromCents(compensationBonusCents),
    gateway_fee_retained: fromCents(gatewayFeeCents),
    cents: {
      refund_amount: totalRefundCents,
      penalty_amount: penaltyCents,
      compensation_bonus: compensationBonusCents,
      gateway_fee_retained: gatewayFeeCents,
    },
  };
}