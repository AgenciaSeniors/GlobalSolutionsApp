import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';

function pickNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Devuelve el markup a aplicar según rol:
 * - client/admin -> default_markup_percentage
 * - agent        -> agent_markup_percentage
 */
export async function getRoleAndMarkupPct(supabaseAdmin: SupabaseClient) {
  // Usuario (si existe) desde cookies
  const supabaseAuth = await createServerClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();

  let role: 'client' | 'agent' | 'admin' = 'client';

  if (user?.id) {
    const { data: prof } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (prof && (prof as any).role) role = (prof as any).role;
  }

  // settings (value es jsonb)
  const { data: rows } = await supabaseAdmin
    .from('app_settings')
    .select('key,value')
    .in('key', ['default_markup_percentage', 'agent_markup_percentage']);

  let clientMarkup: number | null = null;
  let agentMarkup: number | null = null;

  for (const r of rows ?? []) {
    const key = (r as any).key as string;
    const val = (r as any).value;
    const num = pickNumber(val);

    if (key === 'default_markup_percentage') clientMarkup = num;
    if (key === 'agent_markup_percentage') agentMarkup = num;
  }

  const client = clientMarkup ?? 10;
  const agent = agentMarkup ?? client; // si no existe, cae al de cliente

  const markupPct = role === 'agent' ? agent : client;
  return { role, markupPct, clientMarkup: client, agentMarkup: agent };
}

/**
 * Aplica: final = base * (1 + markupPct/100)
 * base = base_price si existe, si no price/final_price
 */
export function applyRoleMarkup(results: any[], markupPct: number) {
  return (results ?? []).map((leg: any) => ({
    ...leg,
    flights: (leg.flights ?? []).map((f: any) => {
      const base =
        pickNumber(f.base_price) ??
        pickNumber(f.price) ??
        pickNumber(f.final_price) ??
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