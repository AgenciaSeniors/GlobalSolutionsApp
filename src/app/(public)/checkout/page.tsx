/**
 * @fileoverview Checkout page — creates booking + passengers, then redirects to /pay for real payment (Stripe/PayPal).
 * Keeps existing UI and UX while making the flow production-correct:
 * - NEVER mark bookings as paid from the frontend.
 * - Stripe/PayPal payment confirmation must happen via backend (intent/order + webhook).
 */

'use client';

import { useEffect, useState, type FormEvent } from 'react';
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

type PassengerForm = {
  first_name: string;
  last_name: string;
  dob: string;
  nationality: string;
  passport_number: string;
  passport_expiry: string;
};

type PassengerField = keyof PassengerForm;

type GatewayFeePctKey = 'stripe_fee_percentage' | 'paypal_fee_percentage' | 'zelle_fee_percentage';
type GatewayFixedFeeKey = 'stripe_fee_fixed' | 'paypal_fee_fixed' | 'zelle_fee_fixed';

function pctKeyForGateway(g: Gateway): GatewayFeePctKey {
  switch (g) {
    case 'stripe':
      return 'stripe_fee_percentage';
    case 'paypal':
      return 'paypal_fee_percentage';
    case 'zelle':
      return 'zelle_fee_percentage';
  }
}

function fixedKeyForGateway(g: Gateway): GatewayFixedFeeKey {
  switch (g) {
    case 'stripe':
      return 'stripe_fee_fixed';
    case 'paypal':
      return 'paypal_fee_fixed';
    case 'zelle':
      return 'zelle_fee_fixed';
  }
}

function safeInt(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export default function CheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { user } = useAuthContext();
  const { settings, loading: settingsLoading, calculateGatewayFee } = useAppSettings();

  const flightId = searchParams.get('flight');
  const passengerCount = safeInt(searchParams.get('passengers'), 1);
  const flightClass = (searchParams.get('class') || 'economy') as 'economy' | 'business' | 'first';

  const classNames = {
    economy: 'Clase Económica',
    business: 'Clase Business',
    first: 'Primera Clase'
  };

  const classMultipliers = {
    economy: 1.0,
    business: 2.5,
    first: 4.0
  };

  const [flight, setFlight] = useState<FlightWithDetails | null>(null);
  const [loading, setLoading] = useState(true);

  const [gateway, setGateway] = useState<Gateway>('stripe');

  const [passengers, setPassengers] = useState<PassengerForm[]>([]);

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Success screen is ONLY for Zelle (manual payment). Stripe/PayPal redirect to /pay.
  const [success, setSuccess] = useState(false);
  const [bookingCode, setBookingCode] = useState('');

  useEffect(() => {
    if (!user) {
      const currentUrl = `/checkout?flight=${flightId ?? ''}&passengers=${passengerCount}`;
      router.push(`/login?redirect=${encodeURIComponent(currentUrl)}`);
      return;
    }

    if (!flightId) {
      router.push('/flights');
      return;
    }

    let cancelled = false;

    async function load() {
      const { data, error: loadErr } = await supabase
        .from('flights')
        .select(
          '*, airline:airlines(*), origin_airport:airports!origin_airport_id(*), destination_airport:airports!destination_airports_id(*)',
        )
        .eq('id', flightId)
        .single();

      if (loadErr || !data) {
        router.push('/flights');
        return;
      }

      if (cancelled) return;

      setFlight(data as FlightWithDetails);

      setPassengers(
        Array.from({ length: passengerCount }, (): PassengerForm => ({
          first_name: '',
          last_name: '',
          dob: '',
          nationality: '',
          passport_number: '',
          passport_expiry: '',
        })),
      );

      setLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flightId, user]);

  if (loading || settingsLoading || !flight) {
    return (
      <>
        <Navbar />
        <div className="flex min-h-screen items-center justify-center pt-20">
          <p className="text-neutral-500">Cargando checkout...</p>
        </div>
      </>
    );
  }

  // Display-only pricing (real pricing must be computed in backend at payment time)
 // Display-only pricing (real pricing must be computed in backend at payment time)
  const classMultiplier = classMultipliers[flightClass];
  const pricePerPerson = flight.final_price * classMultiplier;
  const subtotal = pricePerPerson * passengerCount;
  const gatewayFee = calculateGatewayFee(subtotal, gateway);
  const total = Math.round((subtotal + gatewayFee) * 100) / 100;
  const breakdown: PriceBreakdown = {
    base_price: flight.base_price,
    markup_amount: flight.final_price - flight.base_price,
    subtotal,
    gateway_fee: Math.round(gatewayFee * 100) / 100,
    gateway_fee_pct: settings[pctKeyForGateway(gateway)],
    gateway_fixed_fee: settings[fixedKeyForGateway(gateway)],
    total,
    passengers: passengerCount,
  };

  function updatePassenger(index: number, field: PassengerField, value: string) {
    setPassengers((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)),
    );
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

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user || !flight) return;

    setError(null);

    if (!validatePassengers()) return;

    setProcessing(true);

    try {
      const newBookingCode = `GST-${Date.now().toString(36).toUpperCase().slice(-6)}`;

      // Create booking (always pending until payment is confirmed by backend)
      const { data: booking, error: bookingErr } = await supabase
        .from('bookings')
        .insert({
          booking_code: newBookingCode,
          user_id: user.id,
          flight_id: flight.id,
          flight_class: flightClass,
          subtotal: breakdown.subtotal,
          payment_gateway_fee: gateway === 'zelle' ? 0 : breakdown.gateway_fee,
          total_amount: gateway === 'zelle' ? breakdown.subtotal : breakdown.total,
          payment_method: gateway,
          payment_status: 'pending',
          booking_status: 'pending_emission',
          currency: 'USD',
          pricing_breakdown: breakdown, // optional: keep for UI reference (backend will overwrite later)
        })
        .select('id')
        .single();

      if (bookingErr) throw bookingErr;
      if (!booking?.id) throw new Error('No se pudo crear la reserva.');

      // Insert passengers (keep your existing table name)
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

      // Update available seats (you may want to move this to backend later to avoid race conditions)
      await supabase
        .from('flights')
        .update({ available_seats: flight.available_seats - passengerCount })
        .eq('id', flight.id);

      // ✅ Professional flow:
      // - Zelle: show manual payment instructions
      // - Stripe/PayPal: redirect to /pay which will handle real payment creation/confirmation
      if (gateway === 'zelle') {
        setBookingCode(newBookingCode);
        setSuccess(true);
        return;
      }

      // Stripe/PayPal payment happens in /pay (Module 2)
      router.push(
        `/pay?booking_id=${encodeURIComponent(booking.id)}&method=${encodeURIComponent(gateway)}`,
      );
    } catch (err) {
      // Keep error formatting safe
      console.error(err);
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
                      <div className="mt-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700">
                          {flightClass === 'business' && '💼'}
                          {flightClass === 'first' && '👑'}
                          {flightClass === 'economy' && '✈️'}
                          {' '}{classNames[flightClass]}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-brand-600">${pricePerPerson.toFixed(2)}</p>
                      <p className="text-xs text-neutral-400">por persona</p>
                      {classMultiplier > 1 && (
                        <p className="text-xs text-brand-500">x{classMultiplier} clase premium</p>
                      )}
                    </div>
                  </div>

                  {flight.available_seats < 10 && (
                    <p className="mt-3 text-xs font-semibold text-red-500">
                      ⚠️ Solo quedan {flight.available_seats} asientos disponibles
                    </p>
                  )}
                </Card>

                {passengers.map((p, i) => (
                  <Card key={`${flight.id}-p-${i}`} variant="bordered">
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
                  {gateway === 'zelle'
                    ? `Reservar $${breakdown.subtotal.toFixed(2)}`
                    : `Continuar a pagar`}
                </Button>

                <p className="flex items-center justify-center gap-1.5 text-xs text-neutral-400">
                  <Shield className="h-3 w-3" /> Pago seguro · Datos encriptados
                </p>

                {settings.loyalty_points_per_dollar > 0 && (
                  <div className="rounded-xl bg-amber-50 px-4 py-3 text-center text-xs text-amber-700">
                    ⭐ Ganarás{' '}
                    <strong>
                      {Math.floor(breakdown.subtotal * settings.loyalty_points_per_dollar)} puntos
                    </strong>{' '}
                    de fidelidad con esta compra
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
