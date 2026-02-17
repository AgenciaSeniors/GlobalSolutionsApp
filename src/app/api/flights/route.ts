/**
 * @fileoverview GET /api/flights — Búsqueda pública de vuelos con tipado estricto y Rate Limiting.
 */
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// ✅ 1. Definimos las interfaces para los datos de la base de datos
interface RateLimitRow {
  ip_address: string;
  last_search_at: string;
  search_count: number;
}

interface Airport {
  iata_code: string;
  name: string;
  city?: string;
}

interface Flight {
  id: string;
  final_price: number;
  available_seats: number;
  departure_datetime: string;
  airline: { name: string; logo_url: string } | null;
  origin_airport: Airport | null;
  destination_airport: Airport | null;
}

function getClientIp(request: NextRequest): string {
  const candidates = [
    request.headers.get("x-real-ip"),
    request.headers.get("x-vercel-forwarded-for"),
    request.headers.get("cf-connecting-ip"),
    request.headers.get("x-forwarded-for"),
  ].filter(Boolean) as string[];

  const raw = candidates[0] ?? "";
  if (!raw) return "0.0.0.0";
  return raw.split(",")[0]?.trim() || "0.0.0.0";
}

function makeRateLimitKey(ip: string, userAgent: string): string {
  const secret =
    process.env.RATE_LIMIT_HMAC_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "dev-rate-limit-secret";

  const fp = crypto.createHmac("sha256", secret).update(`${ip}|${userAgent}`).digest("hex").slice(0, 40);
  return `anon:${fp}`;
}

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient();
    
    // Identificación del cliente (C1.3): usuario autenticado por user_id, anónimo por HMAC(ip|UA)
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();

    const userAgent = request.headers.get("user-agent") || "";
    const ip = getClientIp(request);
    const rlKey = auth.user?.id ? `user:${auth.user.id}` : makeRateLimitKey(ip, userAgent);
    const now = new Date();

    // --- BLOQUE DE SEGURIDAD: RATE LIMIT ---
    const { data: rlData } = await supabaseAdmin
      .from('search_rate_limits')
      .select('*')
      .eq('ip_address', rlKey)
      .maybeSingle();

    const rl = rlData as RateLimitRow | null;

    if (rl) {
      const diffMs = now.getTime() - new Date(rl.last_search_at).getTime();
      
      // Límite: 5 búsquedas/30s (anónimo), 10 búsquedas/30s (autenticado)
      const maxPerWindow = auth.user?.id ? 10 : 5;
      if (rl.search_count >= maxPerWindow && diffMs < 30000) {
        return NextResponse.json(
          { error: 'Demasiadas búsquedas. Por seguridad, intente de nuevo en unos minutos.' },
          { status: 429 }
        );
      }

      const newCount = diffMs > 30000 ? 1 : rl.search_count + 1;
      await supabaseAdmin
        .from('search_rate_limits')
        .update({ 
          last_search_at: now.toISOString(), 
          search_count: newCount 
        })
        .eq('ip_address', rlKey);
    } else {
      await supabaseAdmin
        .from('search_rate_limits')
        .insert({ 
          ip_address: rlKey, 
          last_search_at: now.toISOString(), 
          search_count: 1 
        });
    }

    // --- LÓGICA DE BÚSQUEDA ---
    const { searchParams } = request.nextUrl;
    const origin = searchParams.get('from');
    const destination = searchParams.get('to');
    const departure = searchParams.get('departure');

    const supabase = await createClient();

    let query = supabase
      .from('flights')
      .select(`
        *,
        airline:airlines(*),
        origin_airport:airports!origin_airport_id(*),
        destination_airport:airports!destination_airport_id(*)
      `)
      .gt('available_seats', 0)
      .order('final_price', { ascending: true });

    if (departure) {
      query = query
        .gte('departure_datetime', `${departure}T00:00:00`)
        .lte('departure_datetime', `${departure}T23:59:59`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // ✅ 2. Aplicamos el tipo Flight al resultado para eliminar los 'any'
    let flights = (data as unknown as Flight[]) ?? [];

    if (origin) {
      flights = flights.filter(
        (f) => f.origin_airport?.iata_code === origin
      );
    }
    if (destination) {
      flights = flights.filter(
        (f) => f.destination_airport?.iata_code === destination
      );
    }

    return NextResponse.json({ data: flights });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}