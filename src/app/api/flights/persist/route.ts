// src/app/api/flights/persist/route.ts
/**
 * POST /api/flights/persist
 *
 * Persists a flight offer (from external provider search results) into the DB
 * so that subsequent pages can reference it via a real UUID.
 *
 * Strategy:
 *  1. Try createAdminClient (service_role) — bypasses RLS.
 *  2. If that fails with "permission denied", fall back to the server client
 *     (authenticated user via cookies) — requires GRANT + RLS policies.
 *
 * IMPORTANT: `flights.final_price` is GENERATED ALWAYS — never INSERT it.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';

type AnyRecord = Record<string, unknown>;

function isRecord(v: unknown): v is AnyRecord {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function pickString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s || null;
}

function pickNumber(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function upper(s: string | null): string | null {
  if (!s) return null;
  return s.toUpperCase();
}

/**
 * Get the best available Supabase client.
 * Prefers service_role (admin), falls back to authenticated server client.
 */
async function getSupabaseClient(): Promise<{ client: SupabaseClient; source: string }> {
  // --- Try admin client first ---
  try {
    const admin = createAdminClient();

    // Quick smoke test: can we SELECT from airlines?
    const { error: testErr } = await admin
      .from('airlines')
      .select('id')
      .limit(1);

    if (!testErr) {
      return { client: admin, source: 'service_role (admin)' };
    }

    // If "permission denied", the key might be wrong — fall through
    console.warn(
      '[flights/persist] ⚠️ Admin client smoke test failed:',
      testErr.message,
      '— falling back to server client.'
    );
  } catch (err) {
    console.warn('[flights/persist] ⚠️ createAdminClient threw:', err instanceof Error ? err.message : err);
  }

  // --- Fallback: server client (authenticated via cookies) ---
  try {
    const server = await createServerClient();

    // Verify we have a session
    const { data: { user } } = await server.auth.getUser();
    if (!user) {
      throw new Error('No authenticated user in cookies — cannot fall back to server client.');
    }

    console.log('[flights/persist] Using authenticated server client for user:', user.id);
    return { client: server, source: 'authenticated (server)' };
  } catch (err) {
    throw new Error(
      `Neither admin nor server client available. Last error: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export async function POST(req: NextRequest) {
  // ---- Get Supabase client ----
  let supabase: SupabaseClient;
  let clientSource: string;
  try {
    const result = await getSupabaseClient();
    supabase = result.client;
    clientSource = result.source;
    console.log('[flights/persist] Using client:', clientSource);
  } catch (err) {
    console.error('[flights/persist] ❌ No Supabase client available:', err);
    return NextResponse.json(
      { error: 'Server configuration error. No Supabase client available.' },
      { status: 500 }
    );
  }

  // ---- Parse body ----
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 });
  }

  const flight = isRecord(body) && isRecord(body.flight) ? (body.flight as AnyRecord) : null;
  if (!flight) {
    console.error('[flights/persist] ❌ Missing flight object in body.');
    return NextResponse.json({ error: 'flight es requerido en el body.' }, { status: 400 });
  }

  const externalId = pickString(flight.id) ?? pickString(flight.offerId) ?? null;

  // ---- Extract airline ----
  const airline = isRecord(flight.airline) ? (flight.airline as AnyRecord) : {};
  const airlineIata = upper(
    pickString(airline.iata_code) ?? pickString(flight.airline_code) ?? pickString(flight.airline_iata)
  );
  const airlineName = pickString(airline.name) ?? pickString(flight.airline_name) ?? 'Aerolínea';
  const airlineLogo = pickString(airline.logo_url) ?? pickString(airline.logo_symbol_url) ?? null;

  if (!airlineIata) {
    console.error('[flights/persist] ❌ No airline IATA. airline:', JSON.stringify(airline).slice(0, 200));
    return NextResponse.json({ error: 'No se pudo determinar iata_code de la aerolínea.' }, { status: 400 });
  }

  // ---- Extract airports ----
  const originAirport = isRecord(flight.origin_airport) ? (flight.origin_airport as AnyRecord) : {};
  const destAirport = isRecord(flight.destination_airport) ? (flight.destination_airport as AnyRecord) : {};

  const originIata = upper(
    pickString(originAirport.iata_code) ?? pickString(flight.origin_iata) ?? pickString(flight.origin)
  );
  const destIata = upper(
    pickString(destAirport.iata_code) ?? pickString(flight.destination_iata) ?? pickString(flight.destination)
  );

  if (!originIata || !destIata) {
    return NextResponse.json({ error: 'No se pudo determinar IATA origen/destino.' }, { status: 400 });
  }

  // ---- Extract schedule/pricing ----
  const departure = pickString(flight.departure_datetime) ?? pickString(flight.departureTime);
  const arrival = pickString(flight.arrival_datetime) ?? pickString(flight.arrivalTime);
  const flightNumber =
    pickString(flight.flight_number) ?? pickString(flight.flightNumber) ?? pickString(flight.number);

  if (!departure || !arrival || !flightNumber) {
    console.error('[flights/persist] ❌ Missing fields. dep:', departure, 'arr:', arrival, 'fn:', flightNumber);
    return NextResponse.json(
      { error: 'Campos requeridos faltantes: departure_datetime, arrival_datetime o flight_number.' },
      { status: 400 }
    );
  }

  // Price: final_price is GENERATED = base_price * (1 + markup_percentage / 100)
  // We reverse-engineer base_price from the external price.
  const externalPrice = pickNumber(flight.final_price) ?? pickNumber(flight.price) ?? 0;
  const markupPct = pickNumber(flight.markup_percentage) ?? 10;
  const basePrice = markupPct > 0
    ? Math.round((externalPrice / (1 + markupPct / 100)) * 100) / 100
    : externalPrice;

  const aircraftType = pickString(flight.aircraft_type);
  const baggage = pickString(flight.baggage_included);
  const isExclusive = Boolean(flight.is_exclusive_offer);
  const stops = flight.stops != null ? flight.stops : [];

  // ---- Upsert airline ----
  const { data: airlineRow, error: airlineErr } = await supabase
    .from('airlines')
    .upsert(
      {
        iata_code: airlineIata,
        name: airlineName,
        logo_url: airlineLogo,
        is_active: true,
      },
      { onConflict: 'iata_code' }
    )
    .select('id')
    .single();

  if (airlineErr || !airlineRow) {
    console.error('[flights/persist] ❌ Airline upsert failed:', airlineErr?.message, airlineErr?.details, airlineErr?.code);
    return NextResponse.json({ error: `Error aerolínea: ${airlineErr?.message}` }, { status: 500 });
  }

  // ---- Upsert origin airport ----
  const { data: originRow, error: originErr } = await supabase
    .from('airports')
    .upsert(
      {
        iata_code: originIata,
        name: pickString(originAirport.name) ?? originIata,
        city: pickString(originAirport.city) ?? pickString(originAirport.name) ?? originIata,
        country: pickString(originAirport.country) ?? 'N/A',
        timezone: pickString(originAirport.timezone),
      },
      { onConflict: 'iata_code' }
    )
    .select('id')
    .single();

  if (originErr || !originRow) {
    console.error('[flights/persist] ❌ Origin airport upsert failed:', originErr?.message, originErr?.details);
    return NextResponse.json({ error: `Error aeropuerto origen: ${originErr?.message}` }, { status: 500 });
  }

  // ---- Upsert destination airport ----
  const { data: destRow, error: destErr } = await supabase
    .from('airports')
    .upsert(
      {
        iata_code: destIata,
        name: pickString(destAirport.name) ?? destIata,
        city: pickString(destAirport.city) ?? pickString(destAirport.name) ?? destIata,
        country: pickString(destAirport.country) ?? 'N/A',
        timezone: pickString(destAirport.timezone),
      },
      { onConflict: 'iata_code' }
    )
    .select('id')
    .single();

  if (destErr || !destRow) {
    console.error('[flights/persist] ❌ Dest airport upsert failed:', destErr?.message, destErr?.details);
    return NextResponse.json({ error: `Error aeropuerto destino: ${destErr?.message}` }, { status: 500 });
  }

  // ---- Check for existing flight ----
  const { data: existing } = await supabase
    .from('flights')
    .select('id')
    .eq('flight_number', flightNumber)
    .eq('departure_datetime', departure)
    .eq('arrival_datetime', arrival)
    .eq('origin_airport_id', originRow.id)
    .eq('destination_airport_id', destRow.id)
    .maybeSingle();

  if (existing?.id) {
    console.log('[flights/persist] ✅ Reusing flight UUID:', existing.id);
    return NextResponse.json({ id: existing.id, reused: true }, { status: 200 });
  }

  // ---- Insert flight ----
  // CRITICAL: final_price is GENERATED ALWAYS — do NOT include it.
  const { data: flightRow, error: flightErr } = await supabase
    .from('flights')
    .insert({
      airline_id: airlineRow.id,
      origin_airport_id: originRow.id,
      destination_airport_id: destRow.id,
      flight_number: flightNumber,
      departure_datetime: departure,
      arrival_datetime: arrival,
      base_price: basePrice,
      markup_percentage: markupPct,
      total_seats: 200,
      available_seats: pickNumber(flight.available_seats) ?? 200,
      aircraft_type: aircraftType,
      baggage_included: baggage ?? '23kg checked + 8kg carry-on',
      is_exclusive_offer: isExclusive,
      stops: stops,
    })
    .select('id, final_price')
    .single();

  if (flightErr || !flightRow) {
    console.error('[flights/persist] ❌ Flight insert failed:', flightErr?.message, flightErr?.details, flightErr?.hint);
    return NextResponse.json({ error: `Error vuelo: ${flightErr?.message}` }, { status: 500 });
  }

  console.log(
    '[flights/persist] ✅ Flight persisted. UUID:', flightRow.id,
    '| ext:', externalId,
    '| base:', basePrice,
    '| final:', flightRow.final_price,
    '| via:', clientSource
  );

  return NextResponse.json(
    { id: flightRow.id, external_id: externalId, final_price: flightRow.final_price },
    { status: 200 }
  );
}