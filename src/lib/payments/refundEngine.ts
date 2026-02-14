/**
 * Refund Engine - Module 2: Financial Infrastructure
 * 
 * Calculates refund amounts based on business rules.
 * IMPORTANT: Gateway fees are NEVER refunded.
 * 
 * Refund Rules:
 * 1. Customer Request < 48h from purchase: 100% refund (minus gateway fee)
 * 2. Customer Request > 48h from purchase: 50% refund
 * 3. Flight Cancelled by airline: 100% refund + $20 compensation
 */

import { createAdminClient } from "@/lib/supabase/admin";

export type RefundReason = "customer_request" | "flight_cancelled";

export interface RefundCalculation {
  booking_id: string;
  reason: RefundReason;
  original_total: number;
  gateway_fee: number;
  refund_percentage: number;
  refund_amount: number;
  compensation_amount: number;
  total_refund: number;
  hours_since_purchase: number | null;
  is_eligible: boolean;
  notes: string;
}

export interface BookingData {
  id: string;
  total_amount: number;
  payment_gateway_fee: number;
  paid_at: string | null;
  payment_status: string;
  payment_method: string | null;
  pricing_breakdown: {
    subtotal?: number;
    gateway_fee_amount?: number;
    total_amount?: number;
    cents?: {
      subtotal: number;
      gateway_fee_amount: number;
      total_amount: number;
    };
  } | null;
}

// Constants
const HOURS_48_MS = 48 * 60 * 60 * 1000;
const COMPENSATION_FLIGHT_CANCELLED = 20.0;

/**
 * Fetch booking data with payment details
 */
async function fetchBookingData(bookingId: string): Promise<BookingData | null> {
  const supabaseAdmin = createAdminClient();
  
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("id, total_amount, payment_gateway_fee, paid_at, payment_status, payment_method, pricing_breakdown")
    .eq("id", bookingId)
    .single();
  
  if (error || !data) {
    console.error("[RefundEngine] Failed to fetch booking:", error?.message);
    return null;
  }
  
  return data as BookingData;
}

/**
 * Calculate hours since purchase
 */
function calculateHoursSincePurchase(paidAt: string | null): number | null {
  if (!paidAt) return null;
  const paid = new Date(paidAt);
  const now = new Date();
  const diffMs = now.getTime() - paid.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60));
}

/**
 * Calculate refund based on business rules
 * 
 * @param bookingId - UUID of the booking
 * @param reason - Reason for refund
 * @returns RefundCalculation with all details
 */
export async function calculateRefund(
  bookingId: string,
  reason: RefundReason
): Promise<RefundCalculation> {
  // Fetch booking data
  const booking = await fetchBookingData(bookingId);
  
  if (!booking) {
    return {
      booking_id: bookingId,
      reason,
      original_total: 0,
      gateway_fee: 0,
      refund_percentage: 0,
      refund_amount: 0,
      compensation_amount: 0,
      total_refund: 0,
      hours_since_purchase: null,
      is_eligible: false,
      notes: "Booking not found",
    };
  }
  
  // Validate booking can be refunded
  if (booking.payment_status !== "paid") {
    return {
      booking_id: bookingId,
      reason,
      original_total: booking.total_amount,
      gateway_fee: booking.payment_gateway_fee || 0,
      refund_percentage: 0,
      refund_amount: 0,
      compensation_amount: 0,
      total_refund: 0,
      hours_since_purchase: null,
      is_eligible: false,
      notes: `Cannot refund booking with status: ${booking.payment_status}`,
    };
  }
  
  // Extract gateway fee (never refunded)
  const gatewayFee = booking.payment_gateway_fee || 
    booking.pricing_breakdown?.gateway_fee_amount || 
    booking.pricing_breakdown?.cents?.gateway_fee_amount ?
    (booking.pricing_breakdown?.cents?.gateway_fee_amount || 0) / 100 :
    0;
  
  const originalTotal = booking.total_amount;
  const amountWithoutGatewayFee = originalTotal - gatewayFee;
  
  let refundPercentage = 0;
  let compensationAmount = 0;
  let notes = "";
  const hoursSincePurchase = calculateHoursSincePurchase(booking.paid_at);
  
  switch (reason) {
    case "customer_request": {
      if (hoursSincePurchase === null) {
        refundPercentage = 0;
        notes = "Cannot determine purchase time";
      } else if (hoursSincePurchase < 48) {
        // Less than 48 hours: 100% refund minus gateway fee
        refundPercentage = 100;
        notes = "Full refund (within 48h of purchase). Gateway fee not refundable.";
      } else {
        // More than 48 hours: 50% refund
        refundPercentage = 50;
        notes = "Partial refund (50% - after 48h of purchase). Gateway fee not refundable.";
      }
      break;
    }
    
    case "flight_cancelled": {
      // Flight cancelled by airline: 100% + $20 compensation
      refundPercentage = 100;
      compensationAmount = COMPENSATION_FLIGHT_CANCELLED;
      notes = "Full refund + $20 compensation (flight cancelled by airline). Gateway fee not refundable.";
      break;
    }
    
    default: {
      const _exhaustiveCheck: never = reason;
      notes = `Unknown reason: ${_exhaustiveCheck}`;
    }
  }
  
  // Calculate refund amount (percentage of amount without gateway fee)
  const refundAmount = (amountWithoutGatewayFee * refundPercentage) / 100;
  const totalRefund = refundAmount + compensationAmount;
  
  return {
    booking_id: bookingId,
    reason,
    original_total: originalTotal,
    gateway_fee: gatewayFee,
    refund_percentage: refundPercentage,
    refund_amount: refundAmount,
    compensation_amount: compensationAmount,
    total_refund: totalRefund,
    hours_since_purchase: hoursSincePurchase,
    is_eligible: refundPercentage > 0,
    notes,
  };
}

/**
 * Process refund and update database
 * 
 * @param bookingId - UUID of the booking
 * @param reason - Reason for refund
 * @param processedBy - User ID who processed the refund (admin/agent)
 * @returns Result of refund processing
 */
export async function processRefund(
  bookingId: string,
  reason: RefundReason,
  processedBy: string
): Promise<{
  success: boolean;
  calculation: RefundCalculation | null;
  error?: string;
}> {
  const calculation = await calculateRefund(bookingId, reason);
  
  if (!calculation.is_eligible) {
    return {
      success: false,
      calculation,
      error: calculation.notes,
    };
  }
  
  const supabaseAdmin = createAdminClient();
  
  // Update booking with refund information
  const { error: updateError } = await supabaseAdmin
    .from("bookings")
    .update({
      payment_status: "refunded",
      refund_amount: calculation.total_refund,
      refund_reason: reason,
      refunded_at: new Date().toISOString(),
    })
    .eq("id", bookingId);
  
  if (updateError) {
    console.error("[RefundEngine] Failed to update booking:", updateError.message);
    return {
      success: false,
      calculation,
      error: `Database update failed: ${updateError.message}`,
    };
  }
  
  // Log refund event
  const { error: logError } = await supabaseAdmin.rpc("log_payment_event_once", {
    p_provider: calculation.booking_id.toLowerCase().includes("paypal") ? "paypal" : "stripe",
    p_event_id: `refund_${bookingId}_${Date.now()}`,
    p_event_type: "refund.processed",
    p_booking_id: bookingId,
    p_payment_intent_id: null,
    p_payload: {
      reason,
      processed_by: processedBy,
      calculation,
      timestamp: new Date().toISOString(),
    },
  });
  
  if (logError) {
    console.error("[RefundEngine] Failed to log refund event:", logError.message);
    // Don't fail the refund if logging fails
  }
  
  return {
    success: true,
    calculation,
  };
}

/**
 * Check if a booking is eligible for refund
 * 
 * @param bookingId - UUID of the booking
 * @returns Object with eligibility status and available reasons
 */
export async function checkRefundEligibility(bookingId: string): Promise<{
  eligible: boolean;
  reasons: RefundReason[];
  hours_since_purchase: number | null;
  max_refund_amount: number;
}> {
  const booking = await fetchBookingData(bookingId);
  
  if (!booking || booking.payment_status !== "paid") {
    return {
      eligible: false,
      reasons: [],
      hours_since_purchase: null,
      max_refund_amount: 0,
    };
  }
  
  const hoursSincePurchase = calculateHoursSincePurchase(booking.paid_at);
  const reasons: RefundReason[] = ["flight_cancelled"]; // Always available
  
  // Customer request is available if within reasonable time (e.g., before flight)
  // For now, we allow it but with different percentages based on timing
  reasons.push("customer_request");
  
  const calculation = await calculateRefund(bookingId, "flight_cancelled");
  
  return {
    eligible: true,
    reasons,
    hours_since_purchase: hoursSincePurchase,
    max_refund_amount: calculation.total_refund,
  };
}
