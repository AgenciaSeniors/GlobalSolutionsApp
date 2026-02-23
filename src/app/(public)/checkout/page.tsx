// src/app/(public)/checkout/page.tsx
/**
 * @fileoverview Checkout page — creates booking + passengers, then redirects to /pay for real payment (Stripe/PayPal).
 * Supports two booking modes:
 *   1. Flight-based: ?flight={uuid}&passengers=N  (from flight search)
 *   2. Offer-based:  ?offer={uuid}&date=YYYY-MM-DD&passengers=N  (from exclusive offers)
 */

'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';
import { useAuthContext } from '@/components/providers/AuthProvider';
import { useAppSettings } from '@/hooks/useAppSettings';
import { COUNTRIES } from '@/lib/data/countries';
import PriceBreakdownCard from '@/components/features/checkout/PriceBreakdownCard';
import type { FlightWithDetails, PriceBreakdown, SelectedLeg } from '@/types/models';
import type { SpecialOfferStop } from '@/types/models';
import {
  CreditCard,
  Building,
  Banknote,
  Shield,
  Lock,
  CheckCircle,
  Plane,
  AlertTriangle,
  MapPin,
  Flame,
  CircleDot,
  Armchair,
  Luggage,
} from 'lucide-react';
import Image from 'next/image';

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

/** Shape of offer data used in checkout — enriched with flight details */
interface OfferCheckoutData {
  offer_id: string;
  destination: string;
  destination_img: string | null;
  offer_price: number;
  original_price: number;
  flight_number: string | null;
  selected_date: string;
  max_seats: number;
  sold_seats: number;
  tags: string[];
  // Flight detail fields (populated from DB)
  airline_name: string | null;
  airline_logo: string | null;
  airline_iata: string | null;
  origin_city: string | null;
  origin_code: string | null;
  destination_city: string | null;
  destination_code: string | null;
  departure_time: string | null;
  arrival_time: string | null;
  flight_duration: string | null;
  aircraft_type: string | null;
  cabin_class: string | null;
  baggage_included: string | null;
  stops: SpecialOfferStop[];
}

function cabinLabel(cabin: string | null) {
  if (!cabin) return 'Económica';
  const map: Record<string, string> = {
    economy: 'Económica',
    premium_economy: 'Premium Economy',
    business: 'Business',
    first: 'Primera Clase',
  };
  return map[cabin] ?? cabin;
}

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

  // --- URL params (read once) ---
  const offerId = searchParams.get('offer');
  const offerDate = searchParams.get('date');
  const flightId = searchParams.get('flight');
  const passengerCount = parseInt(searchParams.get('passengers') || '1', 10);
  const checkoutMode = searchParams.get('mode'); // 'multicity' | null

  const isOfferMode = Boolean(offerId);
  const isMulticityMode = checkoutMode === 'multicity';

  // --- Offer state ---
  const [offerData, setOfferData] = useState<OfferCheckoutData | null>(null);

  // --- Flight state ---
  const [flight, setFlight] = useState<FlightWithDetails | null>(null);
  const [flightDbId, setFlightDbId] = useState<string | null>(null);
  const [flightProviderId, setFlightProviderId] = useState<string | null>(null);

  // --- Multicity state ---
  const [multicityLegs, setMulticityLegs] = useState<SelectedLeg[]>([]);
  const [multicityFlightIds, setMulticityFlightIds] = useState<string[]>([]);

  // --- Shared state ---
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
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [bookingCode, setBookingCode] = useState('');
  const [serverBreakdown, setServerBreakdown] = useState<PriceBreakdown | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);

  const hasLoadedRef = useRef(false);
  const pricingAbortRef = useRef<AbortController | null>(null);

  // --- Derived values ---
  const pricePerPerson = isMulticityMode
    ? multicityLegs.reduce((acc, leg) => {
        const raw = leg.rawFlight as Record<string, unknown>;
        return acc + Number(raw.final_price ?? raw.price ?? 0);
      }, 0)
    : isOfferMode
      ? (offerData?.offer_price ?? 0)
      : (flight?.final_price ?? 0);

  // BUG 3b FIX: for multicity, both arrays must be filled and in sync
  const isReady = !loading && !settingsLoading && (
    isMulticityMode
      ? multicityLegs.length > 0 && multicityFlightIds.length === multicityLegs.length
      : isOfferMode
        ? !!offerData
        : !!flight
  );

  // --- Data loading ---
  useEffect(() => {
    if (!user) {
      const redirectParams = isMulticityMode
        ? `mode=multicity&passengers=${passengerCount}`
        : offerId
          ? `offer=${offerId}&date=${offerDate ?? ''}&passengers=${passengerCount}`
          : `flight=${flightId ?? ''}&passengers=${passengerCount}`;
      router.push(`/login?redirect=${encodeURIComponent(`/checkout?${redirectParams}`)}`);
      return;
    }

    if (!isMulticityMode && !flightId && !offerId) {
      router.push('/flights');
      return;
    }

    if (isOfferMode && (!offerId || !offerDate)) {
      router.push('/offers');
      return;
    }

    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    async function load() {
      try {
        if (isMulticityMode) {
          // ═══════════════════════════════════════
          // MULTICITY MODE
          // ═══════════════════════════════════════
          let legs: SelectedLeg[] = [];
          try {
            const raw = sessionStorage.getItem('multicity_selected_legs');
            if (raw) {
              const parsed = JSON.parse(raw) as SelectedLeg[];
              if (Array.isArray(parsed) && parsed.length > 0) {
                legs = parsed.sort((a, b) => a.legIndex - b.legIndex);
              }
            }
          } catch (e) {
            console.warn('[Checkout] Failed to read multicity legs from sessionStorage:', e);
          }

          if (legs.length === 0) {
            router.push('/flights');
            return;
          }

          // Persist each leg to DB to get a stable UUID
          const resolvedIds: string[] = [];
          for (const leg of legs) {
            const raw = leg.rawFlight as Record<string, unknown>;
            const rawId = String(raw.id ?? '');
            if (isUuidLike(rawId)) {
              resolvedIds.push(rawId);
            } else {
              try {
                const { uuid } = await persistFlightToDb(raw);
                resolvedIds.push(uuid);
              } catch (err) {
                console.warn('[Checkout] Failed to persist multicity leg:', err);
                setError('Error al preparar uno de los vuelos. Vuelve a seleccionar tu itinerario.');
                setLoading(false);
                return;
              }
            }
          }

          // Validate seat availability for each leg
          for (let i = 0; i < resolvedIds.length; i++) {
            const { data: fl } = await supabase
              .from('flights')
              .select('available_seats')
              .eq('id', resolvedIds[i])
              .single();
            if (fl && (fl.available_seats as number) < passengerCount) {
              setError(
                `El Tramo ${i + 1} no tiene suficientes asientos disponibles. Por favor, elige otro vuelo.`
              );
              setLoading(false);
              return;
            }
          }

          setMulticityLegs(legs);
          setMulticityFlightIds(resolvedIds);
          // Clear sessionStorage after loading
          try { sessionStorage.removeItem('multicity_selected_legs'); } catch { /* ignore */ }
        } else if (isOfferMode) {
          // ═══════════════════════════════════════
          // OFFER MODE
          // ═══════════════════════════════════════
          let offer: OfferCheckoutData | null = null;

          // Always fetch full offer from DB with airline/airport joins
          // (sessionStorage may have stale data or missing flight details)
          try {
            sessionStorage.removeItem('selectedOfferData');
          } catch { /* ignore */ }

          if (offerId) {
            const { data } = await supabase
              .from('special_offers')
              .select('*, airline:airlines(*), origin_airport:airports!origin_airport_id(*), destination_airport:airports!destination_airport_id(*)')
              .eq('id', offerId)
              .single();

            if (data) {
              const airline = data.airline as Record<string, unknown> | null;
              const originAirport = data.origin_airport as Record<string, unknown> | null;
              const destAirport = data.destination_airport as Record<string, unknown> | null;
              const offerStops = (data.stops ?? []) as SpecialOfferStop[];

              offer = {
                offer_id: data.id,
                destination: data.destination,
                destination_img: data.destination_img,
                offer_price: Number(data.offer_price),
                original_price: Number(data.original_price),
                flight_number: data.flight_number,
                selected_date: offerDate!,
                max_seats: data.max_seats,
                sold_seats: data.sold_seats,
                tags: data.tags ?? [],
                // Flight details
                airline_name: airline ? String(airline.name ?? '') : null,
                airline_logo: airline ? (airline.logo_url as string) ?? null : null,
                airline_iata: airline ? String(airline.iata_code ?? '') : null,
                origin_city: data.origin_city ?? (originAirport ? String(originAirport.city ?? '') : null),
                origin_code: originAirport ? String(originAirport.iata_code ?? '') : null,
                destination_city: data.destination_city ?? (destAirport ? String(destAirport.city ?? '') : null),
                destination_code: destAirport ? String(destAirport.iata_code ?? '') : null,
                departure_time: data.departure_time ? String(data.departure_time).slice(0, 5) : null,
                arrival_time: data.arrival_time ? String(data.arrival_time).slice(0, 5) : null,
                flight_duration: data.flight_duration,
                aircraft_type: data.aircraft_type,
                cabin_class: data.cabin_class,
                baggage_included: data.baggage_included,
                stops: offerStops,
              };
            }
          }

          if (!offer) {
            setError('No se encontró la información de la oferta. Por favor, vuelve a seleccionar la oferta.');
            setLoading(false);
            return;
          }

          // 3) Validate seat availability
          const seatsAvailable = offer.max_seats - offer.sold_seats;
          if (seatsAvailable < passengerCount) {
            setError(
              `Solo quedan ${seatsAvailable} cupo(s) disponible(s) para esta oferta. Has seleccionado ${passengerCount} pasajero(s).`
            );
            setLoading(false);
            return;
          }

          setOfferData(offer);
        } else {
          // ═══════════════════════════════════════
          // FLIGHT MODE
          // ═══════════════════════════════════════
          let flightData: FlightWithDetails | null = null;
          let resolvedDbId: string | null = null;
          let resolvedProviderId: string | null = null;

          // 1) Try sessionStorage
          try {
            const cached = sessionStorage.getItem('selectedFlightData');
            if (cached) {
              const parsed = JSON.parse(cached);
              const rawId = String(parsed.id ?? flightId);

              if (isUuidLike(rawId)) {
                flightData = rawToFlightWithDetails(parsed, rawId);
                resolvedDbId = rawId;
              } else {
                // External ID — persist to get a real UUID
                try {
                  const { uuid, externalId } = await persistFlightToDb(parsed);
                  flightData = rawToFlightWithDetails(parsed, uuid);
                  flightData = { ...flightData, id: uuid };
                  resolvedDbId = uuid;
                  resolvedProviderId = externalId;
                } catch (persistErr) {
                  console.warn('[Checkout] Persist failed:', persistErr);
                }
              }
              sessionStorage.removeItem('selectedFlightData');
            }
          } catch (e) {
            console.warn('[Checkout] sessionStorage error:', e);
          }

          // 2) Fallback: fetch from DB if we have a UUID
          if (!flightData && flightId) {
            if (isUuidLike(flightId)) {
              try {
                const { data } = await supabase
                  .from('flights')
                  .select(
                    '*, airline:airlines(*), origin_airport:airports!origin_airport_id(*), destination_airport:airports!destination_airport_id(*)'
                  )
                  .eq('id', flightId)
                  .single();

                if (data) {
                  flightData = data as unknown as FlightWithDetails;
                  resolvedDbId = flightId;
                }
              } catch (err) {
                console.warn('[Checkout] DB query error:', err);
              }
            } else {
              setError(
                'No se encontró la información del vuelo. Esto puede ocurrir si recargas la página. Por favor, vuelve a buscar el vuelo.'
              );
              setLoading(false);
              return;
            }
          }

          if (!flightData || !resolvedDbId) {
            router.push('/flights');
            return;
          }

          // Validate seat availability
          if (flightData.available_seats < passengerCount) {
            setError(
              `Solo quedan ${flightData.available_seats} asiento(s) disponible(s). Has seleccionado ${passengerCount} pasajero(s).`
            );
            setLoading(false);
            return;
          }

          setFlight(flightData);
          setFlightDbId(resolvedDbId);
          setFlightProviderId(resolvedProviderId);
        }

        // Initialize empty passenger forms for both modes
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
      } catch (err) {
        console.error('[Checkout] Unexpected load error:', err);
        setError('Error inesperado al cargar el checkout. Inténtalo de nuevo.');
        setLoading(false);
      }
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flightId, offerId, isMulticityMode, user]);

  // --- Server-side pricing preview (flight mode only) ---
  const fetchPricingPreview = useCallback(async () => {
    if (isOfferMode || !flightDbId) return;

    // Only call when ALL passengers have a DOB filled
    const allDobsFilled = passengers.length > 0 && passengers.every((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.dob));
    if (!allDobsFilled) return;

    // Abort previous in-flight request
    if (pricingAbortRef.current) pricingAbortRef.current.abort();
    const controller = new AbortController();
    pricingAbortRef.current = controller;

    setPricingLoading(true);
    try {
      const res = await fetch('/api/bookings/pricing-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flight_id: flightDbId,
          passengers: passengers.map((p) => ({ date_of_birth: p.dob })),
          gateway,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        setPricingLoading(false);
        return;
      }

      const data = await res.json();
      if (data.breakdown) {
        setServerBreakdown({
          base_price: data.base_price_per_person ?? 0,
          markup_amount: data.markup_amount_per_person ?? 0,
          subtotal: data.breakdown.subtotal ?? 0,
          volatility_buffer: data.breakdown.volatility_buffer ?? 0,
          gateway_fee: data.breakdown.gateway_fee ?? 0,
          gateway_fee_pct: data.breakdown.gateway_fee_pct ?? 0,
          gateway_fixed_fee: data.breakdown.gateway_fixed_fee ?? 0,
          total: data.breakdown.total ?? 0,
          passengers: data.breakdown.passengers ?? passengers.length,
          passenger_details: data.passenger_details ?? undefined,
        });
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.warn('[Checkout] Pricing preview failed:', err);
    } finally {
      setPricingLoading(false);
    }
  }, [isOfferMode, flightDbId, passengers, gateway]);

  useEffect(() => {
    const timer = setTimeout(fetchPricingPreview, 400);
    return () => clearTimeout(timer);
  }, [fetchPricingPreview]);

  // --- Loading / error screen ---
  if (!isReady) {
    return (
      <>
        <Navbar />
        <div className="flex min-h-screen items-center justify-center pt-20">
          {error ? (
            <Card className="max-w-lg text-center">
              <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-red-400" />
              <p className="text-sm text-red-700">{error}</p>
              <Button className="mt-4" onClick={() => router.push(isOfferMode ? '/offers' : '/flights')}>
                {isOfferMode ? 'Volver a ofertas' : 'Volver a buscar vuelos'}
              </Button>
            </Card>
          ) : (
            <p className="text-neutral-500">Cargando checkout...</p>
          )}
        </div>
      </>
    );
  }

  // --- Price breakdown ---
  // Use server breakdown when available (accurate: includes age pricing + volatility buffer).
  // Fall back to client-side calculation while server response is pending.
  const breakdown: PriceBreakdown = (() => {
    if (!isOfferMode && serverBreakdown) {
      return serverBreakdown;
    }

    // Client-side fallback
    const subtotal = pricePerPerson * passengerCount;
    const gatewayFee = calculateGatewayFee(subtotal, gateway);
    const total = Math.round((subtotal + gatewayFee) * 100) / 100;

    const fallback: PriceBreakdown = {
      base_price: pricePerPerson,
      markup_amount: 0,
      subtotal,
      gateway_fee: gateway === 'zelle' ? 0 : Math.round(gatewayFee * 100) / 100,
      gateway_fee_pct: settings[`${gateway}_fee_percentage` as keyof typeof settings] as number,
      gateway_fixed_fee: settings[`${gateway}_fee_fixed` as keyof typeof settings] as number,
      total: gateway === 'zelle' ? subtotal : total,
      passengers: passengerCount,
    };

    if (!isOfferMode && flight) {
      fallback.base_price = flight.base_price;
      fallback.markup_amount = flight.final_price - flight.base_price;
    }

    return fallback;
  })();

  // --- Helpers ---
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
  async function requestZelle(bookingId: string) {
  const res = await fetch('/api/payments/zelle/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      booking_id: bookingId,
      note: 'Checkout: user selected Zelle',
    }),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.error || 'Failed to request Zelle');
  }

  return data as { success: boolean; already_requested?: boolean; repaired?: boolean };
}
  // --- Submit ---
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;

    setError(null);

    if (!validatePassengers()) return;

    setProcessing(true);

    try {
      const newBookingCode = `GST-${Date.now().toString(36).toUpperCase().slice(-6)}`;

      if (isMulticityMode && multicityLegs.length > 0 && multicityFlightIds.length > 0) {
        // ═══ MULTICITY BOOKING ═══
        const totalSubtotal = multicityLegs.reduce((acc, leg) => {
          const raw = leg.rawFlight as Record<string, unknown>;
          return acc + Number(raw.final_price ?? raw.price ?? 0) * passengerCount;
        }, 0);
        const gatewayFeeMulticity = calculateGatewayFee(totalSubtotal, gateway);
        const totalMulticity = Math.round((totalSubtotal + gatewayFeeMulticity) * 100) / 100;

        const { data: booking, error: bookingErr } = await supabase
          .from('bookings')
          .insert({
            booking_code: newBookingCode,
            user_id: user.id,
            profile_id: user.id,
            flight_id: null,
            trip_type: 'multicity',
            subtotal: totalSubtotal,
            payment_gateway_fee: gateway === 'zelle' ? 0 : Math.round(gatewayFeeMulticity * 100) / 100,
            total_amount: gateway === 'zelle' ? totalSubtotal : totalMulticity,
            payment_method: gateway,
            payment_status: 'pending',
            booking_status: 'pending_emission',
            currency: 'USD',
            pricing_breakdown: {
              base_price: pricePerPerson,
              markup_amount: 0,
              subtotal: totalSubtotal,
              gateway_fee: Math.round(gatewayFeeMulticity * 100) / 100,
              gateway_fee_pct: settings[`${gateway}_fee_percentage` as keyof typeof settings] as number,
              gateway_fixed_fee: settings[`${gateway}_fee_fixed` as keyof typeof settings] as number,
              total: totalMulticity,
              passengers: passengerCount,
            },
          })
          .select('id')
          .single();

        if (bookingErr) {
          console.error('[Checkout] Multicity booking insert failed:', bookingErr.message);
          throw bookingErr;
        }

        // Insert one itinerary row per leg
        for (let i = 0; i < multicityLegs.length; i++) {
          const leg = multicityLegs[i];
          const raw = leg.rawFlight as Record<string, unknown>;
          const legSubtotal = Number(raw.final_price ?? raw.price ?? 0) * passengerCount;

          const { error: itinErr } = await supabase.from('booking_itineraries').insert({
            booking_id: booking.id,
            leg_index: i,
            flight_id: multicityFlightIds[i] ?? null,
            origin_iata: leg.legMeta.origin,
            destination_iata: leg.legMeta.destination,
            departure_datetime: String(raw.departure_datetime ?? raw.departureTime ?? '') || null,
            arrival_datetime: String(raw.arrival_datetime ?? raw.arrivalTime ?? '') || null,
            subtotal: legSubtotal,
          });
          if (itinErr) throw itinErr;
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

        // Decrement available_seats on each leg's flight
        for (const flightUuid of multicityFlightIds) {
          const { data: fl } = await supabase
            .from('flights')
            .select('available_seats')
            .eq('id', flightUuid)
            .single();
          if (fl) {
            await supabase
              .from('flights')
              .update({ available_seats: (fl.available_seats as number) - passengerCount })
              .eq('id', flightUuid);
          }
        }

        if (gateway === 'zelle') {
          await requestZelle(booking.id);
          setBookingCode(newBookingCode);
          setSuccess(true);
          return;
        }

        router.push(`/pay?booking_id=${encodeURIComponent(booking.id)}&method=${encodeURIComponent(gateway)}`);
      } else if (isOfferMode && offerData) {
        // ═══ OFFER BOOKING ═══
        const { data: booking, error: bookingErr } = await supabase
          .from('bookings')
          .insert({
            booking_code: newBookingCode,
            profile_id: user.id,
            user_id: user.id,
            offer_id: offerData.offer_id,
            selected_date: offerData.selected_date,
            subtotal: breakdown.subtotal,
            payment_gateway_fee: breakdown.gateway_fee,
            total_amount: breakdown.total,
            payment_method: gateway,
            payment_status: 'pending',
            booking_status: 'pending_emission',
            currency: 'USD',
            pricing_breakdown: breakdown,
          })
          .select('id')
          .single();

        if (bookingErr) {
          console.error('[Checkout] Booking insert failed:', bookingErr.message, bookingErr.details, bookingErr.hint);
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

        // Update sold_seats on the offer
        await supabase
          .from('special_offers')
          .update({ sold_seats: offerData.sold_seats + passengerCount })
          .eq('id', offerData.offer_id);

        if (gateway === 'zelle') {
          await requestZelle(booking.id);
          setBookingCode(newBookingCode);
          setSuccess(true);
          return;
        }

        router.push(`/pay?booking_id=${encodeURIComponent(booking.id)}&method=${encodeURIComponent(gateway)}`);
      } else if (flight && flightDbId) {
        // ═══ FLIGHT BOOKING ═══
        if (!isUuidLike(flightDbId)) {
          setError('Error interno: No se tiene un ID de vuelo válido.');
          return;
        }

        const { data: booking, error: bookingErr } = await supabase
          .from('bookings')
          .insert({
            booking_code: newBookingCode,
            user_id: user.id,
            profile_id: user.id,
            flight_id: flightDbId,
            flight_provider_id: flightProviderId,
            subtotal: breakdown.subtotal,
            payment_gateway_fee: breakdown.gateway_fee,
            total_amount: breakdown.total,
            payment_method: gateway,
            payment_status: 'pending',
            booking_status: 'pending_emission',
            currency: 'USD',
            pricing_breakdown: breakdown,
          })
          .select('id')
          .single();

        if (bookingErr) {
          console.error('[Checkout] Booking insert failed:', bookingErr.message, bookingErr.details, bookingErr.hint);
          throw bookingErr;
        }

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

        await supabase
          .from('flights')
          .update({ available_seats: flight.available_seats - passengerCount })
          .eq('id', flightDbId);

        if (gateway === 'zelle') {
            await requestZelle(booking.id);
            setBookingCode(newBookingCode);
            setSuccess(true);
            return;
          }

        router.push(`/pay?booking_id=${encodeURIComponent(booking.id)}&method=${encodeURIComponent(gateway)}`);
      }
    } catch (err) {
      console.error('[Checkout] Submit error:', err);
      setError(err instanceof Error ? err.message : 'Error al procesar la reserva.');
    } finally {
      setProcessing(false);
    }
  }

  // --- Success screen (Zelle) ---
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

  // --- Display date ---
  // BUG 3a FIX: add multicity branch so displayDate is never empty when flight=null
  const displayDate = isOfferMode && offerData
    ? new Date(offerData.selected_date + 'T12:00:00').toLocaleDateString('es', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : isMulticityMode && multicityLegs.length > 0
      ? multicityLegs[0].legMeta.date
      : flight
        ? new Date(flight.departure_datetime).toLocaleDateString('es', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })
        : '';

  // --- Main checkout UI ---
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-neutral-50 pb-20 pt-24">
        <div className="mx-auto max-w-5xl px-6">
          <h1 className="mb-6 font-display text-2xl font-bold sm:mb-8 sm:text-3xl">Finalizar Compra</h1>

          {error && (
            <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
              <AlertTriangle className="h-5 w-5 flex-shrink-0" /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-5 lg:grid-cols-3">
              <div className="space-y-6 md:col-span-3 lg:col-span-2">
                {/* Booking summary card */}
                <Card variant="bordered">
                  {isMulticityMode && multicityLegs.length > 0 ? (
                    // === MULTICITY SUMMARY ===
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Plane className="h-5 w-5 text-brand-600" />
                        <h3 className="font-bold">Itinerario Multidestino</h3>
                        <span className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700">
                          {multicityLegs.length} tramos
                        </span>
                      </div>
                      {[...multicityLegs].sort((a, b) => a.legIndex - b.legIndex).map((leg, i) => {
                        const raw = leg.rawFlight as Record<string, unknown>;
                        const legPrice = Number(raw.final_price ?? raw.price ?? 0);
                        return (
                          <div key={i} className="flex items-center gap-3 rounded-xl bg-neutral-50 px-4 py-3">
                            <div className="w-6 h-6 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                              {i + 1}
                            </div>
                            <Plane className="h-4 w-4 text-brand-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <span className="font-bold text-sm">{leg.legMeta.origin}</span>
                              <span className="text-neutral-400 mx-1 text-sm">→</span>
                              <span className="font-bold text-sm">{leg.legMeta.destination}</span>
                              <span className="text-neutral-400 text-xs ml-2">{leg.legMeta.date}</span>
                            </div>
                            <div className="text-right text-sm font-bold text-brand-600 flex-shrink-0">
                              ${legPrice.toFixed(2)}
                              <span className="text-xs font-normal text-neutral-400">/p</span>
                            </div>
                          </div>
                        );
                      })}
                      <div className="border-t pt-2 flex justify-between text-sm font-bold text-neutral-700">
                        <span>Total por persona</span>
                        <span>${pricePerPerson.toFixed(2)}</span>
                      </div>
                    </div>
                  ) : isOfferMode && offerData ? (
                    // === OFFER SUMMARY (rich flight details) ===
                    <div className="space-y-4">
                      {/* Header row: image + destination + price */}
                      <div className="flex items-center gap-4">
                        <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-brand-100 overflow-hidden relative">
                          {offerData.destination_img ? (
                            <Image
                              src={offerData.destination_img}
                              alt={offerData.destination}
                              fill
                              sizes="64px"
                              className="object-cover"
                            />
                          ) : (
                            <MapPin className="h-8 w-8 text-brand-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-bold truncate">{offerData.destination}</p>
                            <Flame className="h-4 w-4 flex-shrink-0 text-orange-500" />
                            <span className="flex-shrink-0 rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                              Oferta Exclusiva
                            </span>
                          </div>
                          {offerData.airline_name && (
                            <p className="text-sm text-neutral-500">
                              {offerData.airline_name}
                              {offerData.flight_number && <> · Vuelo {offerData.flight_number}</>}
                            </p>
                          )}
                          <p className="text-xs text-neutral-400 capitalize">{displayDate}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm text-neutral-400 line-through">${offerData.original_price.toFixed(2)}</p>
                          <p className="text-lg font-bold text-emerald-600">${offerData.offer_price.toFixed(2)}</p>
                          <p className="text-xs text-neutral-400">por persona</p>
                        </div>
                      </div>

                      {/* Flight route strip */}
                      {offerData.departure_time && offerData.origin_code && offerData.destination_code && (
                        <div className="rounded-xl bg-neutral-50 px-4 py-3">
                          <div className="flex items-center gap-4">
                            {/* Origin */}
                            <div className="text-center min-w-[60px]">
                              <p className="text-lg font-bold text-brand-950">{offerData.departure_time}</p>
                              <p className="text-sm font-bold text-brand-700">{offerData.origin_code}</p>
                              {offerData.origin_city && (
                                <p className="text-[10px] text-neutral-500 truncate max-w-[80px]">{offerData.origin_city}</p>
                              )}
                            </div>

                            {/* Flight path */}
                            <div className="flex flex-1 flex-col items-center gap-0.5">
                              {offerData.flight_duration && (
                                <p className="text-[10px] text-neutral-500">{offerData.flight_duration}</p>
                              )}
                              <div className="relative flex w-full items-center">
                                <div className="h-[2px] flex-1 bg-brand-200" />
                                {offerData.stops.map((stop, i) => (
                                  <div key={i} className="relative mx-1 flex flex-col items-center">
                                    <CircleDot className="h-2.5 w-2.5 text-amber-500" />
                                    <span className="absolute top-3 whitespace-nowrap text-[9px] font-semibold text-amber-600">
                                      {stop.airport_code}
                                    </span>
                                  </div>
                                ))}
                                <div className="h-[2px] flex-1 bg-brand-200" />
                                <Plane className="-ml-1 h-3.5 w-3.5 text-brand-600" />
                              </div>
                              <p className="text-[10px] font-medium text-brand-600">
                                {offerData.stops.length === 0
                                  ? 'Vuelo directo'
                                  : `${offerData.stops.length} escala${offerData.stops.length > 1 ? 's' : ''}`}
                              </p>
                            </div>

                            {/* Destination */}
                            <div className="text-center min-w-[60px]">
                              <p className="text-lg font-bold text-brand-950">{offerData.arrival_time}</p>
                              <p className="text-sm font-bold text-brand-700">{offerData.destination_code}</p>
                              {offerData.destination_city && (
                                <p className="text-[10px] text-neutral-500 truncate max-w-[80px]">{offerData.destination_city}</p>
                              )}
                            </div>
                          </div>

                          {/* Stop details */}
                          {offerData.stops.length > 0 && (
                            <div className="mt-2 border-t border-neutral-200 pt-2">
                              {offerData.stops.map((stop, i) => (
                                <p key={i} className="text-xs text-neutral-500">
                                  Escala en {stop.city} ({stop.airport_code}) · {stop.duration}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Flight detail pills */}
                      <div className="flex flex-wrap gap-2">
                        {offerData.aircraft_type && (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600">
                            <Plane className="h-3 w-3" /> {offerData.aircraft_type}
                          </span>
                        )}
                        {offerData.cabin_class && (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1 text-xs text-brand-700">
                            <Armchair className="h-3 w-3" /> {cabinLabel(offerData.cabin_class)}
                          </span>
                        )}
                        {offerData.baggage_included && (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600">
                            <Luggage className="h-3 w-3" /> {offerData.baggage_included}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : flight ? (
                    // === FLIGHT SUMMARY ===
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
                        <p className="text-xs text-neutral-400 capitalize">{displayDate}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-brand-600">${flight.final_price.toFixed(2)}</p>
                        <p className="text-xs text-neutral-400">por persona</p>
                      </div>
                    </div>
                  ) : null}

                  {/* Seats warning */}
                  {isOfferMode && offerData && (offerData.max_seats - offerData.sold_seats) < 10 && (
                    <p className="mt-3 text-xs font-semibold text-red-500">
                      Solo quedan {offerData.max_seats - offerData.sold_seats} cupos disponibles
                    </p>
                  )}
                  {!isOfferMode && flight && flight.available_seats < 10 && (
                    <p className="mt-3 text-xs font-semibold text-red-500">
                      Solo quedan {flight.available_seats} asientos disponibles
                    </p>
                  )}
                </Card>

                {/* Passenger forms */}
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
                      <div>
                        <label className="mb-1 block text-sm font-medium text-neutral-700">
                          Nacionalidad <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={p.nationality}
                          onChange={(e) => updatePassenger(i, 'nationality', e.target.value)}
                          required
                          className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-50"
                        >
                          <option value="">Selecciona un país…</option>
                          {COUNTRIES.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.name} ({c.code})
                            </option>
                          ))}
                        </select>
                      </div>
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

                {/* Payment method */}
                <Card variant="bordered">
                  <h3 className="mb-4 font-bold">Método de Pago</h3>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {([
                      {
                        id: 'stripe' as const,
                        icon: CreditCard,
                        label: 'Tarjeta de Crédito/Débito',
                        sub: 'Visa, Mastercard, Amex',
                      },
                      {
                        id: 'paypal' as const,
                        icon: Building,
                        label: 'PayPal',
                        sub: 'Pago con cuenta PayPal',
                      },
                      {
                        id: 'zelle' as const,
                        icon: Banknote,
                        label: 'Zelle',
                        sub: 'Transferencia directa',
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

              {/* Sidebar */}
              <div className="space-y-4 md:col-span-2 lg:col-span-1">
                <PriceBreakdownCard breakdown={breakdown} gateway={gateway} />

                {/* Aceptación de Términos y Política de Privacidad */}
                <label className="flex items-start gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={e => setAcceptedTerms(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-neutral-300 accent-brand-600 cursor-pointer"
                  />
                  <span className="text-xs text-neutral-600 leading-relaxed">
                    He leído y acepto los{' '}
                    <a
                      href="/legal/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-600 underline hover:text-brand-700 font-medium"
                    >
                      Términos y Condiciones
                    </a>{' '}
                    y la{' '}
                    <a
                      href="/legal/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-600 underline hover:text-brand-700 font-medium"
                    >
                      Política de Privacidad
                    </a>{' '}
                    de Global Solutions Travel.
                  </span>
                </label>

                <Button
                  type="submit"
                  isLoading={processing}
                  disabled={processing || !acceptedTerms}
                  className="w-full gap-2"
                >
                  <Lock className="h-4 w-4" />
                  {gateway === 'zelle' ? `Reservar $${breakdown.total.toFixed(2)}` : `Continuar a pagar`}
                </Button>

                <p className="flex items-center justify-center gap-1.5 text-xs text-neutral-400">
                  <Shield className="h-3 w-3" /> Pago seguro · Datos encriptados
                </p>

                {settings.loyalty_points_per_dollar > 0 && (
                  <div className="rounded-xl bg-amber-50 px-4 py-3 text-center text-xs text-amber-700">
                    Ganarás{' '}
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
