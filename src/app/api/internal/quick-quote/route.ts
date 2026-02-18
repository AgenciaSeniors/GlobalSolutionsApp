export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { priceEngine, type FeePolicy } from '@/lib/pricing/priceEngine';
import type {
  QuickQuoteGateway,
  QuickQuoteResponse,
} from '@/types/quickQuote';

const BodySchema = z.object({
  net_price_per_person: z.number().finite().nonnegative(),
  passengers: z.number().int().min(1).max(9),
  markup_percentage: z.number().finite().min(0).max(200),
  gateway: z.enum(['stripe', 'paypal', 'zelle']),
});

type JsonRecord = Record<string, unknown>;

function jsonError(status: number, error: string, extra: JsonRecord = {}) {
  return NextResponse.json({ status, error, ...extra }, { status });
}

function jsonOk(data: QuickQuoteResponse) {
  return NextResponse.json(data, { status: 200 });
}

type AppSettingsRow = {
  stripe_fee_percentage: number | null;
  stripe_fee_fixed: number | null;
  paypal_fee_percentage: number | null;
  paypal_fee_fixed: number | null;
  zelle_fee_percentage: number | null;
  zelle_fee_fixed: number | null;
  currency: string | null;
};

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function gatewayFeePolicy(settings: AppSettingsRow, gateway: QuickQuoteGateway): FeePolicy {
  const pct =
    gateway === 'stripe'
      ? toNumber(settings.stripe_fee_percentage, 0)
      : gateway === 'paypal'
        ? toNumber(settings.paypal_fee_percentage, 0)
        : toNumber(settings.zelle_fee_percentage, 0);

  const fixed =
    gateway === 'stripe'
      ? toNumber(settings.stripe_fee_fixed, 0)
      : gateway === 'paypal'
        ? toNumber(settings.paypal_fee_fixed, 0)
        : toNumber(settings.zelle_fee_fixed, 0);

  if (pct <= 0 && fixed <= 0) return { type: 'none' };
  if (pct > 0 && fixed > 0) return { type: 'mixed', percentage: pct, fixed_amount: fixed };
  if (pct > 0) return { type: 'percentage', percentage: pct };
  return { type: 'fixed', amount: fixed };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const raw: unknown = await req.json();
    const parsed = BodySchema.safeParse(raw);

    if (!parsed.success) {
      return jsonError(400, 'Invalid body', { details: parsed.error.errors });
    }

    const { net_price_per_person, passengers, markup_percentage, gateway } = parsed.data;

    // ── Auth (user) ──
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return jsonError(401, 'Unauthorized');

    // ── Role check (admin or agent) using admin client ──
    const supabaseAdmin = createAdminClient();

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileErr || !profile) {
      return jsonError(404, 'Profile not found');
    }

    const role = typeof profile.role === 'string' ? profile.role : '';
    if (role !== 'admin' && role !== 'agent') {
      return jsonError(403, 'Only admin or agent can use quick quote');
    }

    // ── Settings (fees) ──
    const { data: settings, error: settingsErr } = await supabaseAdmin
      .from('app_settings')
      .select(
        'stripe_fee_percentage, stripe_fee_fixed, paypal_fee_percentage, paypal_fee_fixed, zelle_fee_percentage, zelle_fee_fixed, currency',
      )
      .limit(1)
      .maybeSingle();

    if (settingsErr) {
      return jsonError(500, 'Failed to load app settings', { details: settingsErr.message });
    }

    const settingsRow: AppSettingsRow = {
      stripe_fee_percentage: settings?.stripe_fee_percentage ?? null,
      stripe_fee_fixed: settings?.stripe_fee_fixed ?? null,
      paypal_fee_percentage: settings?.paypal_fee_percentage ?? null,
      paypal_fee_fixed: settings?.paypal_fee_fixed ?? null,
      zelle_fee_percentage: settings?.zelle_fee_percentage ?? null,
      zelle_fee_fixed: settings?.zelle_fee_fixed ?? null,
      currency: settings?.currency ?? 'USD',
    };

    // Cotizador: neto por persona * pasajeros
    const netSubtotal = net_price_per_person * passengers;

    const breakdown = priceEngine({
      base: { amount: netSubtotal, currency: 'USD' },
      markup: { type: 'percentage', percentage: markup_percentage },
      gateway_fee: gatewayFeePolicy(settingsRow, gateway),
      gateway_fee_base: 'pre_fee_total',
    });

    const response: QuickQuoteResponse = {
      currency: 'USD',
      passengers,
      net_price_per_person,
      net_subtotal: netSubtotal,
      markup_percentage,
      gateway,
      breakdown,
    };

    return jsonOk(response);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    // eslint-disable-next-line no-console
    console.error('[Quick Quote API]', msg);
    return jsonError(500, msg);
  }
}
