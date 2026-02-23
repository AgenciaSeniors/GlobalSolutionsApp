export const runtime = 'nodejs';

/**
 * POST /api/bookings/pricing-preview
 *
 * Calculates a full price breakdown BEFORE booking creation.
 * Used by the checkout page to show accurate prices including:
 * - Age-based passenger multipliers (infant 10%, child 75%, adult 100%)
 * - Volatility buffer (3%)
 * - Gateway fees (from app_settings DB)
 *
 * This ensures the checkout preview matches what Stripe/PayPal actually charges.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  calculateBookingTotal,
  getPassengerPricingDetails,
  GATEWAY_FEE_POLICY,
  type PaymentGateway,
} from '@/lib/pricing/bookingPricing';
import { fetchGatewayFeePolicy } from '@/services/pricing.service';

const PassengerSchema = z.object({
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const BodySchema = z.object({
  flight_id: z.string().uuid(),
  passengers: z.array(PassengerSchema).min(1).max(9),
  gateway: z.enum(['stripe', 'paypal', 'zelle']),
});

function parseNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Auth
    const supabaseAuth = await createClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
    }

    // Parse body
    const raw: unknown = await req.json();
    const parsed = BodySchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Body invalido.', details: parsed.error.errors },
        { status: 400 },
      );
    }

    const { flight_id, passengers, gateway } = parsed.data;

    // Fetch flight from DB
    const supabaseAdmin = createAdminClient();
    const { data: flightData, error: flightErr } = await supabaseAdmin
      .from('flights')
      .select('id, base_price, markup_percentage, final_price')
      .eq('id', flight_id)
      .single();

    if (flightErr || !flightData) {
      return NextResponse.json({ error: 'Vuelo no encontrado.' }, { status: 404 });
    }

    const finalPrice = parseNumber(flightData.final_price);
    const basePrice = parseNumber(flightData.base_price);
    const markupPct = parseNumber(flightData.markup_percentage);

    if (finalPrice === null || finalPrice <= 0) {
      return NextResponse.json({ error: 'Precio de vuelo invalido.' }, { status: 400 });
    }

    // For zelle, no gateway fee
    const effectiveGateway: PaymentGateway = gateway === 'zelle' ? 'stripe' : gateway;
    const isZelle = gateway === 'zelle';

    // Fetch gateway fee from DB (or use none for zelle)
    const gatewayFeePolicy = isZelle
      ? { type: 'none' as const }
      : await fetchGatewayFeePolicy(effectiveGateway);

    // Calculate using the same engine as the payment route
    const breakdown = calculateBookingTotal(
      finalPrice,
      passengers,
      effectiveGateway,
      gatewayFeePolicy,
    );

    // Per-passenger detail
    const passengerDetails = getPassengerPricingDetails(finalPrice, passengers);

    // Fetch fee display values from DB for the UI
    const feeDisplayPct = isZelle ? 0 : (
      gateway === 'stripe' ? GATEWAY_FEE_POLICY.stripe.percentage :
      GATEWAY_FEE_POLICY.paypal.percentage
    );
    const feeDisplayFixed = isZelle ? 0 : (
      gateway === 'stripe' ? (GATEWAY_FEE_POLICY.stripe as { fixed_amount: number }).fixed_amount :
      (GATEWAY_FEE_POLICY.paypal as { fixed_amount: number }).fixed_amount
    );

    return NextResponse.json({
      flight_id,
      gateway,
      base_price_per_person: basePrice ?? 0,
      markup_percentage: markupPct ?? 0,
      final_price_per_person: finalPrice,
      markup_amount_per_person: finalPrice - (basePrice ?? finalPrice),
      breakdown: {
        subtotal: breakdown.subtotal,
        markup_amount: finalPrice - (basePrice ?? finalPrice),
        volatility_buffer: breakdown.volatility_buffer_amount,
        gateway_fee: isZelle ? 0 : breakdown.gateway_fee_amount,
        gateway_fee_pct: feeDisplayPct,
        gateway_fixed_fee: feeDisplayFixed,
        total: isZelle
          ? breakdown.subtotal + breakdown.volatility_buffer_amount
          : breakdown.total_amount,
        passengers: passengers.length,
      },
      passenger_details: passengerDetails.map((p) => ({
        index: p.index,
        type: p.type,
        multiplier: p.multiplier,
        price: p.price,
        date_of_birth: p.date_of_birth,
      })),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno.';
    console.error('[pricing-preview]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
