// src/app/api/flights/persist/route.ts
/**
 * POST /api/flights/persist
 *
 * Persists a flight offer (from external provider search results) into the DB
 * so that subsequent pages can reference it via a real UUID.
 *
 * This endpoint uses the Supabase Service Role (createAdminClient) to bypass RLS.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

type AnyRecord = Record<string, unknown>;

function isRecord(v: unknown): v is AnyRecord {
  return typeof v === 'object' && v !== null;
}

function pickString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s ? s : null;
}

function pickNumber(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function upper3(s: string | null): string | null {
  if (!s) return null;
  const u = s.toUpperCase();
  return u.length === 3 ? u : u;
}

export async function POST(req: NextRequest) {
  const supabase = createAdminClient();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 });
  }

  const flight = isRecord(body) && isRecord(body.flight) ? (body.flight as AnyRecord) : null;
  if (!flight) {
    return NextResponse.json({ error: 'flight es requerido.' }, { status: 400 });
  }

  // ---- Extract airline ----
  const airline = isRecord(flight.airline) ? (flight.airline as AnyRecord) : {};
  const airlineIata = upper3(
    pickString(airline.iata_code) ?? pickString(flight.airline_code) ?? pickString(flight.airline_iata)
  );
  const airlineName = pickString(airline.name) ?? pickString(flight.airline_name) ?? 'Aerolínea';
  const airlineLogo = pickString(airline.logo_url) ?? pickString((airline as AnyRecord).logo_symbol_url) ?? null;

  if (!airlineIata) {
    return NextResponse.json({ error: 'No se pudo determinar iata_code de la aerolínea.' }, { status: 400 });
  }

  // ---- Extract airports ----
  const originAirport = isRecord(flight.origin_airport) ? (flight.origin_airport as AnyRecord) : {};
  const destAirport = isRecord(flight.destination_airport) ? (flight.destination_airport as AnyRecord) : {};

  const originIata = upper3(
    pickString(originAirport.iata_code) ?? pickString(flight.origin_iata) ?? pickString(flight.origin)
  );
  const destIata = upper3(
    pickString(destAirport.iata_code) ?? pickString(flight.destination_iata) ?? pickString(flight.destination)
  );

  if (!originIata || !destIata) {
    return NextResponse.json({ error: 'No se pudo determinar IATA origen/destino.' }, { status: 400 });
  }

  // ---- Extract schedule/pricing ----
  const departure = pickString(flight.departure_datetime) ?? pickString(flight.departureTime);
  const arrival = pickString(flight.arrival_datetime) ?? pickString(flight.arrivalTime);
  const flightNumber =
    pickString(flight.flight_number) ?? pickString(flight.flightNumber) ?? pickString((flight as AnyRecord).number);

  if (!departure || !arrival || !flightNumber) {
    return NextResponse.json(
      { error: 'Campos requeridos faltantes: departure_datetime, arrival_datetime o flight_number.' },
      { status: 400 }
    );
  }

  const basePrice = pickNumber(flight.base_price) ?? pickNumber(flight.price) ?? 0;
  const markupPct = pickNumber(flight.markup_percentage) ?? 0;
  const finalPrice = pickNumber(flight.final_price) ?? pickNumber(flight.price) ?? basePrice;
  const aircraftType = pickString(flight.aircraft_type);
  const baggage = pickString(flight.baggage_included);
  const isExclusive = Boolean(flight.is_exclusive_offer);

  // ---- Upsert airline & airports (by iata_code) ----
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
    return NextResponse.json({ error: airlineErr?.message ?? 'Error guardando aerolínea.' }, { status: 500 });
  }

  const { data: originRow, error: originErr } = await supabase
    .from('airports')
    .upsert(
      {
        iata_code: originIata,
        name: pickString(originAirport.name) ?? originIata,
        city: pickString((originAirport as AnyRecord).city) ?? originIata,
        country: pickString((originAirport as AnyRecord).country) ?? '',
        timezone: pickString((originAirport as AnyRecord).timezone),
        is_active: true,
      },
      { onConflict: 'iata_code' }
    )
    .select('id')
    .single();

  if (originErr || !originRow) {
    return NextResponse.json({ error: originErr?.message ?? 'Error guardando aeropuerto origen.' }, { status: 500 });
  }

  const { data: destRow, error: destErr } = await supabase
    .from('airports')
    .upsert(
      {
        iata_code: destIata,
        name: pickString(destAirport.name) ?? destIata,
        city: pickString((destAirport as AnyRecord).city) ?? destIata,
        country: pickString((destAirport as AnyRecord).country) ?? '',
        timezone: pickString((destAirport as AnyRecord).timezone),
        is_active: true,
      },
      { onConflict: 'iata_code' }
    )
    .select('id')
    .single();

  if (destErr || !destRow) {
    return NextResponse.json({ error: destErr?.message ?? 'Error guardando aeropuerto destino.' }, { status: 500 });
  }

  // ---- Reuse if an identical flight already exists ----
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
    return NextResponse.json({ id: existing.id }, { status: 200 });
  }

  // ---- Insert flight ----
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
      final_price: finalPrice,
      total_seats: 200,
      available_seats: 200,
      aircraft_type: aircraftType,
      baggage_included: baggage,
      is_exclusive_offer: isExclusive,
    })
    .select('id')
    .single();

  if (flightErr || !flightRow) {
    return NextResponse.json({ error: flightErr?.message ?? 'Error guardando vuelo.' }, { status: 500 });
  }

  return NextResponse.json({ id: flightRow.id }, { status: 200 });
}
