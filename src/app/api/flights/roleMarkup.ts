import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';

function numFromJsonb(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Regla FINAL (como tú la definiste):
 * - Cliente: base * (1 + markup_cliente/100)
 * - Gestor (role=agent): base * (1 + markup_gestor/100)
 *
 * NO se suman.
 */
export async function getRoleAndMarkupPct(supabaseAdmin: SupabaseClient) {
  // 1) User desde cookies (anon client server-side)
  const supabaseAuth = await createServerClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();

  // 2) Role (por defecto client si no hay user)
  let role: 'client' | 'agent' | 'admin' = 'client';

  if (user?.id) {
    const { data: prof } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const r = (prof as any)?.role;
    if (r === 'agent' || r === 'admin' || r === 'client') role = r;
  }

  // 3) Markups desde app_settings (value es jsonb)
  const { data: rows } = await supabaseAdmin
    .from('app_settings')
    .select('key,value')
    .in('key', ['default_markup_percentage', 'agent_markup_percentage']);

  let clientMarkup: number | null = null;
  let agentMarkup: number | null = null;

  for (const row of rows ?? []) {
    const k = (row as any).key as string;
    const v = (row as any).value;
    const n = numFromJsonb(v);

    if (k === 'default_markup_percentage') clientMarkup = n;
    if (k === 'agent_markup_percentage') agentMarkup = n;
  }

  const client = clientMarkup ?? 10;
  const agent = agentMarkup ?? client; // si no existe, usa el de cliente para no romper

  const markupPct = role === 'agent' ? agent : client;
  return { role, markupPct, clientMarkup: client, agentMarkup: agent };
}

/**
 * Aplica markup a results NORMALIZADOS.
 * Deja estos campos:
 * - base_price
 * - markup_percentage
 * - final_price
 * - price (igual a final_price para que el front no cambie)
 */
export function applyRoleMarkup(results: any[], markupPct: number) {
  return (results ?? []).map((leg: any) => ({
    ...leg,
    flights: (leg.flights ?? []).map((f: any) => {
      const base =
        numFromJsonb(f.base_price) ??
        numFromJsonb(f.price) ??
        numFromJsonb(f.final_price) ??
        0;

      const final = round2(base * (1 + markupPct / 100));

      return {
        ...f,
        base_price: base,
        markup_percentage: markupPct,
        final_price: final,
        price: final,
      };
    }),
  }));
}