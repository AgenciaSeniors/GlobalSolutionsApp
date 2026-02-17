/**
 * @fileoverview Flight detail page — complete technical specs.
 * Per spec §3.4: Must show airline, aircraft model, departure/arrival,
 * layover durations, IATA codes, baggage allowance.
 * Per spec §5.1: Transparent pricing with breakdown.
 * Per spec §8 step 4: Login required only at purchase time.
 * @module app/(public)/flights/[id]/page
 */
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { createClient } from '@/lib/supabase/client';
import { useAuthContext } from '@/components/providers/AuthProvider';
import type { FlightWithDetails } from '@/types/models';
import {
  Plane, MapPin, Calendar, Users, Shield,
  Luggage, ArrowRight, ArrowLeft, CreditCard, ChevronDown, Briefcase, Crown, Armchair
} from 'lucide-react';

export default function FlightDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { user } = useAuthContext();

  const [flight, setFlight] = useState<FlightWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [passengers, setPassengers] = useState(
    parseInt(searchParams.get('passengers') || '1', 10)
  );
  const [showPricing, setShowPricing] = useState(false);
  const [flightClass, setFlightClass] = useState<'economy' | 'business' | 'first'>('economy');

  useEffect(() => {
  async function load() {
    const { data, error } = await supabase
      .from('flights')
      .select('*')
      .eq('id', params.id)
      .single();
    
    console.log('Flight data:', data);
    console.log('Flight error:', error);
    
    if (error) {
      console.error('Error loading flight:', error);
      setFlight(null);
      setLoading(false);
      return;
    }
    
    if (data) {
      setFlight(data as unknown as FlightWithDetails);
    }
    setLoading(false);
  }
  if (params.id) load();
}, [params.id, supabase]);

  function handleBook() {
    if (!user) {
      router.push(`/login?redirect=/flights/${params.id}`);
      return;
    }
    router.push(`/checkout?flight=${params.id}&passengers=${passengers}&class=${flightClass}`);
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen flex items-center justify-center"><p>Cargando...</p></main>
        <Footer />
      </>
    );
  }

  if (!flight) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen flex items-center justify-center">
          <Card className="text-center">
            <p className="text-lg font-semibold">Vuelo no encontrado</p>
            <Link href="/flights" className="mt-4 inline-block text-brand-600 hover:underline">← Buscar vuelos</Link>
          </Card>
        </main>
        <Footer />
      </>
    );
  }

  const departure = new Date(flight.departure_datetime);
  const arrival = new Date(flight.arrival_datetime);
  const durationMs = arrival.getTime() - departure.getTime();
  const durationH = Math.floor(durationMs / 3600000);
  const durationM = Math.round((durationMs % 3600000) / 60000);

  const classMultipliers = {
    economy: 1.0,
    business: 2.5,
    first: 4.0
  };

  const classMultiplier = classMultipliers[flightClass];
  const pricePerPerson = flight.final_price * classMultiplier;
  const markupAmount = flight.final_price - flight.base_price;
  const subtotal = pricePerPerson * passengers;
  // Estimate gateway fee (Stripe default)
  const gatewayFee = subtotal * 0.054 + 0.30;
  const total = subtotal + gatewayFee;

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-neutral-50 pt-[72px] pb-20">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <Link href="/flights/search" className="mb-6 inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-brand-600">
            <ArrowLeft className="h-4 w-4" /> Volver a resultados
          </Link>

          {/* ── Flight Route Header ── */}
          <Card className="mb-6 bg-gradient-to-r from-brand-600 to-brand-800 text-white overflow-hidden">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20">
                  <Plane className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-brand-200 text-sm">{flight.airline.name}</p>
                  <p className="text-xl font-bold">{flight.flight_number}</p>
                </div>
              </div>
              <div className="text-right">
                {flight.is_exclusive_offer && (
                  <Badge variant="warning" className="mb-1">🔥 Oferta Exclusiva</Badge>
                )}
                <p className="text-3xl font-extrabold">${flight.final_price.toFixed(2)}</p>
                <p className="text-brand-200 text-sm">por persona (económica)</p>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* ── Left: Flight Details ── */}
            <div className="lg:col-span-2 space-y-6">
              {/* Route Timeline */}
              <Card variant="bordered">
                <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-brand-500" /> Itinerario
                </h2>
                <div className="flex items-center gap-6">
                  {/* Departure */}
                  <div className="text-center">
                    <p className="text-3xl font-bold text-brand-900">
                      {departure.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </p>
                    <p className="font-semibold text-lg">{flight.origin_airport.iata_code}</p>
                    <p className="text-sm text-neutral-500">{flight.origin_airport.city}</p>
                    <p className="text-xs text-neutral-400">{flight.origin_airport.name}</p>
                  </div>

                  {/* Duration */}
                  <div className="flex-1 text-center">
                    <p className="text-sm font-semibold text-neutral-500">{durationH}h {durationM}m</p>
                    <div className="relative my-2">
                      <div className="h-0.5 bg-brand-200 w-full" />
                      <ArrowRight className="absolute right-0 -top-2 h-4 w-4 text-brand-400" />
                    </div>
                    <p className="text-xs text-neutral-400">Directo</p>
                  </div>

                  {/* Arrival */}
                  <div className="text-center">
                    <p className="text-3xl font-bold text-brand-900">
                      {arrival.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </p>
                    <p className="font-semibold text-lg">{flight.destination_airport.iata_code}</p>
                    <p className="text-sm text-neutral-500">{flight.destination_airport.city}</p>
                    <p className="text-xs text-neutral-400">{flight.destination_airport.name}</p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-neutral-100">
                  <p className="text-sm text-neutral-500">
                    <Calendar className="inline h-4 w-4 mr-1" />
                    {departure.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </Card>

              {/* §3.4 Technical Details */}
              <Card variant="bordered">
                <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <Plane className="h-5 w-5 text-brand-500" /> Ficha Técnica del Vuelo
                </h2>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="rounded-xl bg-neutral-50 p-3">
                    <p className="text-xs font-semibold uppercase text-neutral-400 mb-1">Aerolínea</p>
                    <p className="font-semibold">{flight.airline.name}</p>
                    <p className="text-neutral-500">IATA: {flight.airline.iata_code}</p>
                  </div>
                  <div className="rounded-xl bg-neutral-50 p-3">
                    <p className="text-xs font-semibold uppercase text-neutral-400 mb-1">Aeronave</p>
                    <p className="font-semibold">{flight.aircraft_type || 'Por confirmar'}</p>
                    <p className="text-neutral-500">Modelo de avión</p>
                  </div>
                  <div className="rounded-xl bg-neutral-50 p-3">
                    <p className="text-xs font-semibold uppercase text-neutral-400 mb-1">Duración Total</p>
                    <p className="font-semibold">{durationH} horas {durationM} minutos</p>
                    <p className="text-neutral-500">Vuelo directo</p>
                  </div>
                  <div className="rounded-xl bg-neutral-50 p-3">
                    <p className="text-xs font-semibold uppercase text-neutral-400 mb-1">Asientos Disponibles</p>
                    <p className={`font-semibold ${flight.available_seats <= 5 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {flight.available_seats} restantes
                    </p>
                    <p className="text-neutral-500">de {flight.total_seats} total</p>
                  </div>
                </div>
              </Card>

              {/* Baggage Info */}
              <Card variant="bordered">
                <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <Luggage className="h-5 w-5 text-brand-500" /> Equipaje Permitido
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-sm">
                  <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-3 border border-emerald-100">
                    <span className="text-xl">🎒</span>
                    <div>
                      <p className="font-semibold">Personal</p>
                      <p className="text-xs text-neutral-500">1 artículo personal (bajo asiento)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl bg-blue-50 p-3 border border-blue-100">
                    <span className="text-xl">💼</span>
                    <div>
                      <p className="font-semibold">Mano</p>
                      <p className="text-xs text-neutral-500">1 maleta de mano (8-10 kg)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl bg-purple-50 p-3 border border-purple-100">
                    <span className="text-xl">🧳</span>
                    <div>
                      <p className="font-semibold">Bodega</p>
                      <p className="text-xs text-neutral-500">1 maleta (23 kg) — sujeto a aerolínea</p>
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-xs text-neutral-400">
                  * El equipaje permitido puede variar según la aerolínea y clase de tarifa.
                  Consulta las condiciones de {flight.airline.name} para detalles específicos.
                </p>
              </Card>
            </div>

            {/* ── Right: Booking Card ── */}
            <div className="space-y-4">
              <Card variant="bordered" className="sticky top-24">
                <h3 className="font-bold text-lg mb-4">Reservar este vuelo</h3>

                {/* Passenger selector */}
                <div className="mb-4">
                  <label className="text-sm font-medium text-neutral-700 mb-1.5 block">
                    <Users className="inline h-4 w-4 mr-1" /> Pasajeros
                  </label>
                  <select
                    value={passengers}
                    onChange={e => setPassengers(Number(e.target.value))}
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm"
                  >
                    {Array.from({ length: Math.min(9, flight.available_seats) }, (_, i) => (
                      <option key={i + 1} value={i + 1}>{i + 1} pasajero{i > 0 ? 's' : ''}</option>
                    ))}
                  </select>
                </div>

                {/* Clase de vuelo */}
                <div className="mb-4">
                  <label className="text-sm font-medium text-neutral-700 mb-2 block">
                    Clase de Vuelo
                  </label>
                  <div className="space-y-2">
                    {([
                      { id: 'economy' as const, name: 'Económica', icon: Armchair, multiplier: 1.0 },
                      { id: 'business' as const, name: 'Business', icon: Briefcase, multiplier: 2.5 },
                      { id: 'first' as const, name: 'Primera', icon: Crown, multiplier: 4.0 }
                    ]).map(option => {
                      const Icon = option.icon;
                      const classPrice = flight.final_price * option.multiplier;
                      const isSelected = flightClass === option.id;
                      
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setFlightClass(option.id)}
                          className={`w-full rounded-lg border-2 p-3 text-left transition-all ${
                            isSelected
                              ? 'border-brand-500 bg-brand-50'
                              : 'border-neutral-200 hover:border-neutral-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                                isSelected ? 'bg-brand-600 text-white' : 'bg-neutral-100 text-neutral-600'
                              }`}>
                                <Icon className="h-4 w-4" />
                              </div>
                              <div>
                                <p className={`text-sm font-semibold ${isSelected ? 'text-brand-900' : 'text-neutral-900'}`}>
                                  {option.name}
                                </p>
                                {option.multiplier > 1 && (
                                  <p className="text-xs text-neutral-500">
                                    {option.multiplier}x precio base
                                  </p>
                                )}
                              </div>
                            </div>
                            <p className={`text-sm font-bold ${isSelected ? 'text-brand-600' : 'text-neutral-700'}`}>
                              ${classPrice.toFixed(2)}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* §5.1 Price Breakdown — Transparent */}
                <div className="space-y-2 rounded-xl bg-neutral-50 p-4 text-sm mb-4">
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Precio base (por persona)</span>
                    <span>${flight.base_price.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Margen de servicio</span>
                    <span>${markupAmount.toFixed(2)}</span>
                  </div>
                  {classMultiplier > 1 && (
                    <div className="flex justify-between text-brand-600">
                      <span>Clase {flightClass === 'business' ? 'Business' : 'Primera'}</span>
                      <span>x{classMultiplier}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold">
                    <span>Subtotal ({passengers} pax)</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>

                  <button
                    onClick={() => setShowPricing(!showPricing)}
                    className="flex items-center gap-1 text-xs text-brand-600 hover:underline"
                  >
                    <ChevronDown className={`h-3 w-3 transition-transform ${showPricing ? 'rotate-180' : ''}`} />
                    {showPricing ? 'Ocultar' : 'Ver'} comisión de pasarela
                  </button>

                  {showPricing && (
                    <div className="flex justify-between text-neutral-500">
                      <span>Comisión pasarela (est. 5.4%)</span>
                      <span>${gatewayFee.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="border-t border-neutral-200 pt-2 flex justify-between text-lg font-bold">
                    <span>Total estimado</span>
                    <span className="text-brand-700">${total.toFixed(2)}</span>
                  </div>
                </div>

                <Button onClick={handleBook} className="w-full gap-2">
                  <CreditCard className="h-4 w-4" />
                  {user ? 'Continuar al pago' : 'Iniciar sesión para reservar'}
                </Button>

                {!user && (
                  <p className="text-xs text-neutral-400 text-center mt-2">
                    Puedes ver todos los detalles sin cuenta. Solo se requiere login al comprar.
                  </p>
                )}

                <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-neutral-400">
                  <Shield className="h-3 w-3" /> Pago seguro · PCI-DSS · Datos encriptados
                </div>
              </Card>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}