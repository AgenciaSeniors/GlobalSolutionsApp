// src/app/(public)/checkout/page.tsx
/**
 * @fileoverview Checkout page — creates booking + passengers, then redirects to /pay for real payment (Stripe/PayPal).
 * Keeps existing UI and UX while making the flow production-correct:
 * - NEVER mark bookings as paid from the frontend.
 * - Stripe/PayPal payment confirmation must happen via backend (intent/order + webhook).
 * - External flight IDs are persisted to DB first to get a real UUID before creating booking.
 */

'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';
import { useAuthContext } from '@/components/providers/AuthProvider';
import { useAppSettings } from '@/hooks/useAppSettings';
import PriceBreakdownCard from '@/components/features/checkout/PriceBreakdownCard';
import type { FlightWithDetails, PriceBreakdown } from '@/types/models';
import {
  CreditCard,
  Building,
  Banknote,
  Shield,
  Lock,
  CheckCircle,
  Plane,
  AlertTriangle,
} from 'lucide-react';

// Helper component to render label + input (your Input doesn't accept label prop)
const FormField = ({
  label,
  ...props
}: React.ComponentProps<typeof Input> & { label: string }) => (
  <div className="space-y-1.5">
    <label className="text-sm font-medium text-neutral-700">{label}</label>
    <Input {...props} />
  </div>
);

type Gateway = 'stripe' | 'paypal' | 'zelle';

/**
 * Helper: converts any raw flight object (from DB or from external stub)
 * into the FlightWithDetails shape that the checkout UI expects.
 */
function rawToFlightWithDetails(parsed: Record<string, unknown>, fallbackId: string): FlightWithDetails {
  const airline = (parsed.airline ?? {}) as Record<string, unknown>;
  const originAirport = (parsed.origin_airport ?? {}) as Record<string, unknown>;
  const destAirport = (parsed.destination_airport ?? {}) as Record<string, unknown>;

  return {
    id: String(parsed.id ?? fallbackId),
    airline_id: String(parsed.airline_id ?? airline.id ?? ''),
    flight_number: String(parsed.flight_number ?? ''),
    origin_airport_id: String(parsed.origin_airport_id ?? ''),
    destination_airport_id: String(parsed.destination_airport_id ?? ''),
    departure_datetime: String(parsed.departure_datetime ?? ''),
    arrival_datetime: String(parsed.arrival_datetime ?? ''),
    base_price: Number(parsed.base_price ?? parsed.price ?? parsed.final_price ?? 0),
    markup_percentage: Number(parsed.markup_percentage ?? 0),
    final_price: Number(parsed.final_price ?? parsed.price ?? 0),
    total_seats: Number(parsed.total_seats ?? 100),
    available_seats: Number(parsed.available_seats ?? 50),
    aircraft_type: (parsed.aircraft_type as string) ?? null,
    is_exclusive_offer: Boolean(parsed.is_exclusive_offer),
    offer_expires_at: (parsed.offer_expires_at as string) ?? null,
    stops: (parsed.stops as FlightWithDetails['stops']) ?? null,
    created_at: String(parsed.created_at ?? new Date().toISOString()),
    updated_at: String(parsed.updated_at ?? new Date().toISOString()),
    airline: {
      id: String(airline.id ?? ''),
      iata_code: String(airline.iata_code ?? ''),
      name: String(airline.name ?? 'Aerolínea'),
      logo_url: (airline.logo_url as string) ?? null,
      is_active: airline.is_active !== false,
    },
    origin_airport: {
      id: String(originAirport.id ?? ''),
      iata_code: String(originAirport.iata_code ?? ''),
      name: String(originAirport.name ?? ''),
      city: String(originAirport.city ?? 'Origen'),
      country: String(originAirport.country ?? ''),
      timezone: (originAirport.timezone as string) ?? null,
    },
    destination_airport: {
      id: String(destAirport.id ?? ''),
      iata_code: String(destAirport.iata_code ?? ''),
      name: String(destAirport.name ?? ''),
      city: String(destAirport.city ?? 'Destino'),
      country: String(destAirport.country ?? ''),
      timezone: (destAirport.timezone as string) ?? null,
    },
  } as FlightWithDetails;
}

function isUuidLike(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

/**
 * Persist an external flight to the DB and get a real UUID.
 * Returns { uuid, externalId } or throws with a descriptive message.
 */
async function persistFlightToDb(
  rawFlightData: Record<string, unknown>
): Promise<{ uuid: string; externalId: string | null }> {
  const externalId = String(rawFlightData.id ?? '');

  const res = await fetch('/api/flights/persist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flight: rawFlightData }),
  });

  const json = (await res.json()) as { id?: string; error?: string };

  if (!res.ok) {
    throw new Error(json?.error ?? `Error al persistir vuelo (HTTP ${res.status})`);
  }

  if (!json?.id || !isUuidLike(json.id)) {
    throw new Error('El servidor no devolvió un UUID válido para el vuelo.');
  }

  return { uuid: json.id, externalId: externalId || null };
}

export default function CheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { user } = useAuthContext();
  const { settings, loading: settingsLoading, calculateGatewayFee } = useAppSettings();

  const flightId = searchParams.get('flight');
  const offerId = searchParams.get('offer');
  const offerDate = searchParams.get('date');
  const passengerCount = parseInt(searchParams.get('passengers') || '1', 10);

  const [flight, setFlight] = useState<FlightWithDetails | null>(null);
  // The real UUID that will be used for the booking (may differ from flightId in URL)
  const [flightDbId, setFlightDbId] = useState<string | null>(null);
  // The external provider ID (e.g. "12079-2602270500--32407-0-15608-2602270740")
  const [flightProviderId, setFlightProviderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [gateway, setGateway] = useState<Gateway>('stripe');
  const [passengers, setPassengers] = useState<
    Array<{
      first_name: string;
      last_name: string;
      dob: string;
      nationality: string;
      passport_number: string;
      passport_expiry: string;
    }>
  >([]);

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Success screen is ONLY for Zelle (manual payment). Stripe/PayPal redirect to /pay.
  const [success, setSuccess] = useState(false);
  const [bookingCode, setBookingCode] = useState('');

  // ✅ Guard against React Strict Mode double-execution of useEffect
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!user) {
      // Build redirect URL preserving either flight or offer params
      const redirectParams = offerId
        ? `offer=${offerId}&date=${offerDate ?? ''}`
        : `flight=${flightId ?? ''}&passengers=${passengerCount}`;
      router.push(`/login?redirect=${encodeURIComponent(`/checkout?${redirectParams}`)}`);
      return;
    }

    if (!flightId && !offerId) {
      router.push('/flights');
      return;
    }

    // ✅ Prevent double execution (React Strict Mode in dev calls useEffect twice)
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    async function load() {
      let flightData: FlightWithDetails | null = null;
      let resolvedDbId: string | null = null;
      let resolvedProviderId: string | null = null;

      // ✅ 1) Try to load from sessionStorage first (works for ALL flight sources)
      try {
        const cached = sessionStorage.getItem('selectedFlightData');
        if (cached) {
          const parsed = JSON.parse(cached) as Record<string, unknown>;
          const parsedId = String(parsed?.id ?? '');

          // Verify it matches the flight ID in the URL
          if (parsedId === flightId) {
            flightData = rawToFlightWithDetails(parsed, flightId);

            // If this is an external (non-UUID) offer id, persist it to DB now and replace the id with a UUID.
            if (!isUuidLike(flightData.id)) {
              try {
                const { uuid, externalId } = await persistFlightToDb(parsed);
                resolvedDbId = uuid;
                resolvedProviderId = externalId;
                // Update the flightData with the DB UUID
                flightData = { ...flightData, id: uuid };
                console.log('[Checkout] ✅ Persisted external offer -> UUID:', uuid, '| external_id:', externalId);
              } catch (persistErr) {
                console.error('[Checkout] ❌ Persist failed:', persistErr);
                setError(
                  `No se pudo registrar el vuelo en el sistema: ${persistErr instanceof Error ? persistErr.message : 'Error desconocido'}. Por favor, intenta de nuevo o selecciona otro vuelo.`
                );
                setLoading(false);
                return; // ❌ STOP — don't proceed without a valid UUID
              }
            } else {
              // Already a UUID (from DB)
              resolvedDbId = flightData.id;
            }

            console.log('[Checkout] ✅ Loaded flight from sessionStorage:', flightData.airline.name, flightData.flight_number);
          }

          // Clear after reading
          sessionStorage.removeItem('selectedFlightData');
        }
      } catch (e) {
        console.warn('[Checkout] sessionStorage error:', e);
      }

      // ✅ 2) If coming from an exclusive offer, load offer data and build synthetic flight
      if (!flightData && offerId) {
        try {
          const { data: offer, error: offerErr } = await supabase
            .from('special_offers')
            .select(
              '*, origin_airport:airports!origin_airport_id(*), destination_airport:airports!destination_airport_id(*), airline:airlines!airline_id(*)'
            )
            .eq('id', offerId)
            .single();

          if (offerErr) {
            console.warn('[Checkout] Offer lookup failed:', offerErr.message);
          }

          if (offer) {
            const syntheticFlight: Record<string, unknown> = {
              id: offer.id,
              airline_id: offer.airline_id,
              flight_number: offer.flight_number || 'OFFER',
              origin_airport_id: offer.origin_airport_id,
              destination_airport_id: offer.destination_airport_id,
              departure_datetime: offerDate ? `${offerDate}T08:00:00Z` : new Date().toISOString(),
              arrival_datetime: offerDate ? `${offerDate}T23:59:59Z` : new Date().toISOString(),
              base_price: offer.offer_price / (1 + ((offer.markup_percentage ?? 10) / 100)),
              markup_percentage: offer.markup_percentage ?? 10,
              final_price: offer.offer_price,
              total_seats: offer.max_seats,
              available_seats: Math.max(0, offer.max_seats - offer.sold_seats),
              is_exclusive_offer: true,
              offer_id: offer.id,
              airline: offer.airline || {},
              origin_airport: offer.origin_airport || {},
              destination_airport: offer.destination_airport || {},
            };

            flightData = rawToFlightWithDetails(syntheticFlight, offer.id);

            // Persist to DB to get a real UUID for the booking
            try {
              const { uuid } = await persistFlightToDb(syntheticFlight);
              resolvedDbId = uuid;
              flightData = { ...flightData, id: uuid };
              console.log('[Checkout] ✅ Offer persisted -> UUID:', uuid);
            } catch (persistErr) {
              console.warn('[Checkout] Offer persist failed, using offer ID:', persistErr);
              resolvedDbId = offer.id;
            }
          }
        } catch (err) {
          console.warn('[Checkout] Offer load error:', err);
        }
      }

      // ✅ 3) If sessionStorage didn't have it and no offer, try DB (only works for real DB UUIDs)
      if (!flightData && flightId) {
        const isUUID = isUuidLike(flightId);

        if (isUUID) {
          try {
            const { data, error: dbError } = await supabase
              .from('flights')
              .select(
                '*, airline:airlines(*), origin_airport:airports!origin_airport_id(*), destination_airport:airports!destination_airport_id(*)'
              )
              .eq('id', flightId)
              .single();

            if (dbError) {
              console.warn('[Checkout] DB lookup failed:', dbError.message);
            }

            if (data) {
              flightData = data as unknown as FlightWithDetails;
              resolvedDbId = flightId;
              console.log('[Checkout] ✅ Loaded flight from DB');
            }
          } catch (err) {
            console.warn('[Checkout] DB query error:', err);
          }
        } else {
          // Non-UUID and no sessionStorage data — we can't proceed
          console.warn('[Checkout] ❌ Non-UUID flight ID without sessionStorage data:', flightId);
          setError(
            'No se encontró la información del vuelo. Esto puede ocurrir si recargas la página. Por favor, vuelve a buscar el vuelo.'
          );
          setLoading(false);
          return;
        }
      }

      // ✅ 4) If still no data, redirect back
      if (!flightData || !resolvedDbId) {
        console.warn('[Checkout] ❌ Flight/offer not found for id:', flightId ?? offerId);
        router.push(offerId ? '/offers' : '/flights');
        return;
      }

      setFlight(flightData);
      setFlightDbId(resolvedDbId);
      setFlightProviderId(resolvedProviderId);

      setPassengers(
        Array.from({ length: passengerCount }, () => ({
          first_name: '',
          last_name: '',
          dob: '',
          nationality: '',
          passport_number: '',
          passport_expiry: '',
        }))
      );

      setLoading(false);
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flightId, offerId, user]);

  if (loading || settingsLoading || !flight) {
    return (
      <>
        <Navbar />
        <div className="flex min-h-screen items-center justify-center pt-20">
          {error ? (
            <Card className="max-w-lg text-center">
              <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-red-400" />
              <p className="text-sm text-red-700">{error}</p>
              <Button className="mt-4" onClick={() => router.push('/flights')}>
                Volver a buscar vuelos
              </Button>
            </Card>
          ) : (
            <p className="text-neutral-500">Cargando checkout...</p>
          )}
        </div>
      </>
    );
  }

  // Display-only pricing (real pricing must be computed in backend at payment time)
  const subtotal = flight.final_price * passengerCount;
  const gatewayFee = calculateGatewayFee(subtotal, gateway);
  const total = Math.round((subtotal + gatewayFee) * 100) / 100;

  const breakdown: PriceBreakdown = {
    base_price: flight.base_price,
    markup_amount: flight.final_price - flight.base_price,
    subtotal,
    gateway_fee: Math.round(gatewayFee * 100) / 100,
    gateway_fee_pct: settings[`${gateway}_fee_percentage` as keyof typeof settings] as number,
    gateway_fixed_fee: settings[`${gateway}_fee_fixed` as keyof typeof settings] as number,
    total,
    passengers: passengerCount,
  };

  function updatePassenger(index: number, field: string, value: string) {
    setPassengers((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  }

  function validatePassengers(): boolean {
    for (let i = 0; i < passengers.length; i++) {
      const p = passengers[i];

      if (!p.first_name.trim() || !p.last_name.trim()) {
        setError(`Pasajero ${i + 1}: Nombre y apellido son obligatorios.`);
        return false;
      }
      if (!p.dob) {
        setError(`Pasajero ${i + 1}: Fecha de nacimiento requerida.`);
        return false;
      }
      if (!p.nationality.trim()) {
        setError(`Pasajero ${i + 1}: Nacionalidad requerida.`);
        return false;
      }
      if (!p.passport_number.trim()) {
        setError(`Pasajero ${i + 1}: Número de pasaporte requerido.`);
        return false;
      }
      if (!p.passport_expiry) {
        setError(`Pasajero ${i + 1}: Vencimiento de pasaporte requerido.`);
        return false;
      }
      if (new Date(p.passport_expiry) < new Date()) {
        setError(`Pasajero ${i + 1}: El pasaporte está vencido.`);
        return false;
      }
    }
    return true;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || !flight) return;

    setError(null);

    if (!validatePassengers()) return;

    // ✅ CRITICAL: Ensure we have a real UUID before inserting the booking
    if (!flightDbId || !isUuidLike(flightDbId)) {
      setError(
        'Error interno: No se tiene un ID de vuelo válido. Por favor, vuelve a seleccionar el vuelo.'
      );
      return;
    }

    setProcessing(true);

    try {
      const newBookingCode = `GST-${Date.now().toString(36).toUpperCase().slice(-6)}`;

      // Create booking using the real UUID
      const { data: booking, error: bookingErr } = await supabase
        .from('bookings')
        .insert({
          booking_code: newBookingCode,
          user_id: user.id,
          flight_id: flightDbId, // ✅ Always a real UUID
          flight_provider_id: flightProviderId, // ✅ Store external ID for reference
          subtotal: breakdown.subtotal,
          payment_gateway_fee: gateway === 'zelle' ? 0 : breakdown.gateway_fee,
          total_amount: gateway === 'zelle' ? breakdown.subtotal : breakdown.total,
          payment_method: gateway,
          payment_status: 'pending',
          booking_status: 'pending_emission',
          currency: 'USD',
          pricing_breakdown: breakdown,
        })
        .select('id')
        .single();

      if (bookingErr) {
        console.error('[Checkout] ❌ Booking insert failed:', bookingErr.message, bookingErr.details, bookingErr.hint);
        throw bookingErr;
      }

      // Insert passengers
      for (const p of passengers) {
        const { error: pErr } = await supabase.from('booking_passengers').insert({
          booking_id: booking.id,
          first_name: p.first_name.trim(),
          last_name: p.last_name.trim(),
          date_of_birth: p.dob,
          nationality: p.nationality.trim().toUpperCase(),
          passport_number: p.passport_number.trim(),
          passport_expiry_date: p.passport_expiry,
        });
        if (pErr) throw pErr;
      }

      // Update available seats
      await supabase
        .from('flights')
        .update({ available_seats: flight.available_seats - passengerCount })
        .eq('id', flightDbId);

      if (gateway === 'zelle') {
        setBookingCode(newBookingCode);
        setSuccess(true);
        return;
      }

      router.push(`/pay?booking_id=${encodeURIComponent(booking.id)}&method=${encodeURIComponent(gateway)}`);
    } catch (err) {
      console.error('[Checkout] ❌ Submit error:', err);
      setError(err instanceof Error ? err.message : 'Error al procesar la reserva.');
    } finally {
      setProcessing(false);
    }
  }

  if (success) {
    return (
      <>
        <Navbar />
        <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50 to-white pt-20">
          <Card className="max-w-lg text-center">
            <CheckCircle className="mx-auto mb-4 h-16 w-16 text-emerald-500" />
            <h1 className="text-2xl font-bold">¡Reserva Creada!</h1>
            <p className="mt-2 font-mono text-lg font-bold text-brand-600">{bookingCode}</p>
            <p className="mt-3 text-neutral-600">
              Realiza la transferencia por Zelle y un agente confirmará tu pago en 2–4 horas.
            </p>
            <p className="mt-4 text-sm text-neutral-400">Estado: Pendiente de Pago</p>
            <div className="mt-6 flex justify-center gap-3">
              <Button onClick={() => router.push('/user/dashboard/bookings')}>Ver Mis Reservas</Button>
              <Button variant="outline" onClick={() => router.push('/')}>
                Volver al Inicio
              </Button>
            </div>
          </Card>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-neutral-50 pb-20 pt-24">
        <div className="mx-auto max-w-5xl px-6">
          <h1 className="mb-8 font-display text-3xl font-bold">Finalizar Compra</h1>

          {error && (
            <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
              <AlertTriangle className="h-5 w-5 flex-shrink-0" /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                <Card variant="bordered">
                  <div className="flex items-center gap-4">
                    <Plane className="h-8 w-8 text-brand-600" />
                    <div className="flex-1">
                      <p className="font-bold">
                        {flight.airline.name} {flight.flight_number}
                      </p>
                      <p className="text-sm text-neutral-500">
                        {flight.origin_airport.city} ({flight.origin_airport.iata_code}) →{' '}
                        {flight.destination_airport.city} ({flight.destination_airport.iata_code})
                      </p>
                      <p className="text-xs text-neutral-400">
                        {new Date(flight.departure_datetime).toLocaleDateString('es', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-brand-600">${flight.final_price.toFixed(2)}</p>
                      <p className="text-xs text-neutral-400">por persona</p>
                    </div>
                  </div>

                  {flight.available_seats < 10 && (
                    <p className="mt-3 text-xs font-semibold text-red-500">
                      ⚠️ Solo quedan {flight.available_seats} asientos disponibles
                    </p>
                  )}
                </Card>

                {passengers.map((p, i) => (
                  <Card key={i} variant="bordered">
                    <h3 className="mb-4 font-bold">
                      Pasajero {i + 1} de {passengerCount}
                    </h3>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormField
                        label="Nombre (como en pasaporte)"
                        value={p.first_name}
                        onChange={(e) => updatePassenger(i, 'first_name', e.target.value)}
                        placeholder="María"
                        required
                      />
                      <FormField
                        label="Apellido (como en pasaporte)"
                        value={p.last_name}
                        onChange={(e) => updatePassenger(i, 'last_name', e.target.value)}
                        placeholder="García"
                        required
                      />
                      <FormField
                        label="Fecha de Nacimiento"
                        type="date"
                        value={p.dob}
                        onChange={(e) => updatePassenger(i, 'dob', e.target.value)}
                        required
                      />
                      <FormField
                        label="Nacionalidad"
                        value={p.nationality}
                        onChange={(e) => updatePassenger(i, 'nationality', e.target.value)}
                        placeholder="CUB"
                        maxLength={3}
                        required
                      />
                      <FormField
                        label="Número de Pasaporte"
                        value={p.passport_number}
                        onChange={(e) => updatePassenger(i, 'passport_number', e.target.value)}
                        placeholder="A12345678"
                        required
                      />
                      <FormField
                        label="Vencimiento Pasaporte"
                        type="date"
                        value={p.passport_expiry}
                        onChange={(e) => updatePassenger(i, 'passport_expiry', e.target.value)}
                        required
                      />
                    </div>

                    <p className="mt-3 flex items-center gap-1.5 text-xs text-neutral-400">
                      <Lock className="h-3 w-3" />
                      Los datos del pasaporte se almacenan encriptados con AES-256
                    </p>
                  </Card>
                ))}

                <Card variant="bordered">
                  <h3 className="mb-4 font-bold">Método de Pago</h3>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {([
                      {
                        id: 'stripe' as const,
                        icon: CreditCard,
                        label: 'Tarjeta (Stripe)',
                        sub: `${settings.stripe_fee_percentage}% + $${settings.stripe_fee_fixed.toFixed(2)}`,
                      },
                      {
                        id: 'paypal' as const,
                        icon: Building,
                        label: 'PayPal',
                        sub: `${settings.paypal_fee_percentage}% + $${settings.paypal_fee_fixed.toFixed(2)}`,
                      },
                      {
                        id: 'zelle' as const,
                        icon: Banknote,
                        label: 'Zelle',
                        sub: 'Sin comisión',
                      },
                    ] as const).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setGateway(m.id)}
                        className={`rounded-xl border-2 p-4 text-left transition-all ${
                          gateway === m.id
                            ? 'border-brand-500 bg-brand-50'
                            : 'border-neutral-200 hover:border-neutral-300'
                        }`}
                      >
                        <m.icon
                          className={`mb-2 h-6 w-6 ${
                            gateway === m.id ? 'text-brand-600' : 'text-neutral-400'
                          }`}
                        />
                        <p className="text-sm font-semibold">{m.label}</p>
                        <p className="text-xs text-neutral-500">{m.sub}</p>
                      </button>
                    ))}
                  </div>

                  {gateway === 'zelle' && (
                    <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                      <strong>Zelle:</strong> Realiza la transferencia a{' '}
                      <span className="font-mono font-bold">{settings.business_email}</span> y un agente confirmará tu
                      pago en 2–4 horas.
                    </div>
                  )}
                </Card>
              </div>

              <div className="space-y-4">
                <PriceBreakdownCard breakdown={breakdown} gateway={gateway} />

                <Button type="submit" isLoading={processing} className="w-full gap-2">
                  <Lock className="h-4 w-4" />
                  {gateway === 'zelle' ? `Reservar $${breakdown.subtotal.toFixed(2)}` : `Continuar a pagar`}
                </Button>

                <p className="flex items-center justify-center gap-1.5 text-xs text-neutral-400">
                  <Shield className="h-3 w-3" /> Pago seguro · Datos encriptados
                </p>

                {settings.loyalty_points_per_dollar > 0 && (
                  <div className="rounded-xl bg-amber-50 px-4 py-3 text-center text-xs text-amber-700">
                    ⭐ Ganarás{' '}
                    <strong>{Math.floor(breakdown.subtotal * settings.loyalty_points_per_dollar)} puntos</strong> de
                    fidelidad con esta compra
                  </div>
                )}
              </div>
            </div>
          </form>
        </div>
      </main>
      <Footer />
    </>
  );
}