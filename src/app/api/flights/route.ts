/**
 * @fileoverview GET /api/flights — Búsqueda pública de vuelos con tipado estricto y Rate Limiting.
 */
import { NextRequest, NextResponse } from 'next/server';
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

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient();
    
    // Identificación del cliente por IP
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const now = new Date();

    // --- BLOQUE DE SEGURIDAD: RATE LIMIT ---
    const { data: rlData } = await supabaseAdmin
      .from('search_rate_limits')
      .select('*')
      .eq('ip_address', ip)
      .maybeSingle();

    const rl = rlData as RateLimitRow | null;

    if (rl) {
      const diffMs = now.getTime() - new Date(rl.last_search_at).getTime();
      
      // Límite: 5 búsquedas cada 30 segundos
      if (rl.search_count >= 5 && diffMs < 30000) {
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
        .eq('ip_address', ip);
    } else {
      await supabaseAdmin
        .from('search_rate_limits')
        .insert({ 
          ip_address: ip, 
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