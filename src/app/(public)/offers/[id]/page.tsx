/**
 * @fileoverview Offer detail page with complete flight information and interactive calendar.
 * Shows: airline, route, times, duration, aircraft, baggage, stops, cabin class, price.
 * @module app/(public)/offers/[id]/page
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import OfferCalendar from '@/components/features/offers/OfferCalendar';
import { createClient } from '@/lib/supabase/client';
import { useAuthContext } from '@/components/providers/AuthProvider';
import {
  ArrowLeft,
  Flame,
  MapPin,
  Plane,
  Clock,
  Shield,
  Luggage,
  ArrowRight,
  CircleDot,
  Timer,
  Users,
  Armchair,
} from 'lucide-react';
import Link from 'next/link';
import type { SpecialOffer, SpecialOfferStop } from '@/types/models';

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

export default function OfferDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const { user } = useAuthContext();

  const [offer, setOffer] = useState<SpecialOffer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('special_offers')
        .select('*, airline:airlines(*), origin_airport:airports!origin_airport_id(*), destination_airport:airports!destination_airport_id(*)')
        .eq('id', params.id)
        .single();
      setOffer(data as SpecialOffer | null);
      setLoading(false);
    }
    if (params.id) load();
  }, [params.id]);

  const defaultDate = useMemo(() => {
    if (!offer?.valid_dates?.length) return null;
    const today = new Date();
    const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const sorted = [...offer.valid_dates].sort((a, b) => a.localeCompare(b));
    return sorted.find((d) => new Date(d) >= todayMid) ?? sorted[0] ?? null;
  }, [offer?.valid_dates]);

  function handleSelectDate(date: string) {
    if (!user) {
      router.push(`/login?redirect=/offers/${params.id}`);
      return;
    }
    router.push(`/checkout?offer=${params.id}&date=${date}&passengers=1`);
  }

  function handleHeroClick() {
    if (!defaultDate) return;
    handleSelectDate(defaultDate);
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen flex items-center justify-center pt-[72px]">
          <p className="text-neutral-500">Cargando oferta...</p>
        </main>
        <Footer />
      </>
    );
  }

  if (!offer) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen flex items-center justify-center pt-[72px]">
          <Card className="text-center max-w-md">
            <p className="text-lg font-semibold">Oferta no encontrada</p>
            <Link href="/offers" className="mt-4 inline-block text-brand-600 hover:underline">
              ← Ver todas las ofertas
            </Link>
          </Card>
        </main>
        <Footer />
      </>
    );
  }

  const seatsLeft = offer.max_seats - offer.sold_seats;
  const savingsPct = Math.round(((offer.original_price - offer.offer_price) / offer.original_price) * 100);
  const stops = (offer.stops ?? []) as SpecialOfferStop[];
  const isDirectFlight = stops.length === 0;
  const originCode = offer.origin_airport?.iata_code ?? '';
  const destCode = offer.destination_airport?.iata_code ?? '';
  const originCity = offer.origin_city ?? offer.origin_airport?.city ?? '';
  const destCity = offer.destination_city ?? offer.destination_airport?.city ?? offer.destination;

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-neutral-50 pt-[72px]">
        {/* Hero */}
        <div className="relative bg-gradient-to-br from-brand-900 via-brand-800 to-indigo-900 py-12 lg:py-16">
          {offer.destination_img && (
            <div className="absolute inset-0">
              <img src={offer.destination_img} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-brand-950/90 via-brand-900/80 to-indigo-900/70" />
            </div>
          )}
          <div className="relative mx-auto max-w-6xl px-6">
            <Link
              href="/offers"
              className="mb-4 inline-flex items-center gap-1 text-sm text-brand-200 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Volver a ofertas
            </Link>

            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  {offer.tags.includes('fire') && <Flame className="h-5 w-5 text-orange-400" />}
                  {offer.tags.map(tag => (
                    <Badge key={tag} variant="warning" className="text-xs">
                      {tag === 'exclusive' ? 'Exclusivo' : tag === 'flash_24h' ? 'Flash 24h' : tag === 'few_seats' ? 'Pocos cupos' : tag}
                    </Badge>
                  ))}
                </div>
                <h1 className="font-display text-3xl lg:text-4xl font-bold text-white">
                  <MapPin className="mr-2 inline h-7 w-7 text-brand-300" />
                  {offer.destination}
                </h1>
                {offer.urgency_label && (
                  <p className="mt-2 text-lg text-amber-300 font-semibold">{offer.urgency_label}</p>
                )}
                {offer.airline?.name && (
                  <p className="mt-1 text-sm text-brand-200">
                    Operado por <span className="font-semibold text-white">{offer.airline.name}</span>
                    {offer.flight_number && <> &middot; Vuelo {offer.flight_number}</>}
                  </p>
                )}
              </div>
              <div className="text-left lg:text-right">
                <p className="text-lg text-brand-300 line-through">${offer.original_price}</p>
                <p className="text-4xl lg:text-5xl font-extrabold text-white">${offer.offer_price}</p>
                <p className="mt-1 text-sm text-emerald-300 font-semibold">Ahorras {savingsPct}%</p>
                <p className="text-xs text-brand-200 mt-1">por persona</p>
              </div>
            </div>
          </div>
        </div>

        {/* Flight Info Strip */}
        {offer.departure_time && (
          <div className="bg-white border-b border-neutral-200 shadow-sm">
            <div className="mx-auto max-w-6xl px-6 py-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                {/* Route visual */}
                <div className="flex items-center gap-4 md:gap-6 flex-1">
                  {/* Origin */}
                  <div className="text-center min-w-[80px]">
                    <p className="text-2xl font-bold text-brand-950">{offer.departure_time?.slice(0, 5)}</p>
                    <p className="text-lg font-bold text-brand-700">{originCode}</p>
                    <p className="text-xs text-neutral-500 truncate max-w-[100px]">{originCity}</p>
                  </div>

                  {/* Flight path visual */}
                  <div className="flex-1 flex flex-col items-center gap-1 px-2">
                    <p className="text-xs text-neutral-500 font-medium">{offer.flight_duration}</p>
                    <div className="relative w-full flex items-center">
                      <div className="h-[2px] flex-1 bg-brand-200" />
                      {stops.map((stop, i) => (
                        <div key={i} className="relative flex flex-col items-center mx-1">
                          <CircleDot className="h-3 w-3 text-amber-500" />
                          <span className="absolute top-4 text-[10px] text-amber-600 font-semibold whitespace-nowrap">
                            {stop.airport_code}
                          </span>
                        </div>
                      ))}
                      <div className="h-[2px] flex-1 bg-brand-200" />
                      <Plane className="h-4 w-4 text-brand-600 -ml-1" />
                    </div>
                    <p className="text-xs font-medium text-brand-600">
                      {isDirectFlight ? 'Vuelo directo' : `${stops.length} escala${stops.length > 1 ? 's' : ''}`}
                    </p>
                  </div>

                  {/* Destination */}
                  <div className="text-center min-w-[80px]">
                    <p className="text-2xl font-bold text-brand-950">{offer.arrival_time?.slice(0, 5)}</p>
                    <p className="text-lg font-bold text-brand-700">{destCode}</p>
                    <p className="text-xs text-neutral-500 truncate max-w-[100px]">{destCity}</p>
                  </div>
                </div>

                {/* Quick info pills */}
                <div className="flex flex-wrap gap-2 md:flex-col md:items-end">
                  {offer.aircraft_type && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-700">
                      <Plane className="h-3 w-3" /> {offer.aircraft_type}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700">
                    <Armchair className="h-3 w-3" /> {cabinLabel(offer.cabin_class)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
            {/* Calendar */}
            <div className="lg:col-span-3">
              <OfferCalendar
                validDates={offer.valid_dates}
                offerPrice={offer.offer_price}
                originalPrice={offer.original_price}
                destination={offer.destination}
                onSelectDate={handleSelectDate}
              />
            </div>

            {/* Info sidebar */}
            <div className="lg:col-span-2 space-y-4">
              {/* Flight Details Card */}
              <Card variant="bordered">
                <h3 className="font-bold mb-4 flex items-center gap-2">
                  <Plane className="h-5 w-5 text-brand-600" />
                  Detalles del Vuelo
                </h3>
                <div className="space-y-4 text-sm">
                  {/* Airline */}
                  {offer.airline && (
                    <div className="flex items-center gap-3">
                      {offer.airline.logo_url ? (
                        <img src={offer.airline.logo_url} alt={offer.airline.name} className="h-8 w-8 rounded-lg object-contain" />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 text-xs font-bold text-brand-700">
                          {offer.airline.iata_code}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold">{offer.airline.name}</p>
                        {offer.flight_number && (
                          <p className="text-xs text-neutral-500">Vuelo {offer.flight_number}</p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="border-t border-neutral-100" />

                  {/* Route */}
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-brand-500 flex-shrink-0" />
                    <div>
                      <p className="font-semibold">Ruta</p>
                      <p className="text-neutral-600">
                        {originCity} {originCode && `(${originCode})`}
                        <ArrowRight className="inline h-3 w-3 mx-1.5 text-neutral-400" />
                        {destCity} {destCode && `(${destCode})`}
                      </p>
                    </div>
                  </div>

                  {/* Schedule */}
                  {offer.departure_time && (
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-brand-500 flex-shrink-0" />
                      <div>
                        <p className="font-semibold">Horario</p>
                        <p className="text-neutral-600">
                          Sale {offer.departure_time?.slice(0, 5)} &middot; Llega {offer.arrival_time?.slice(0, 5)}
                          {offer.flight_duration && <span className="text-neutral-400"> ({offer.flight_duration})</span>}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Stops */}
                  {stops.length > 0 ? (
                    <div className="flex items-start gap-3">
                      <CircleDot className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">{stops.length} Escala{stops.length > 1 ? 's' : ''}</p>
                        {stops.map((stop, i) => (
                          <p key={i} className="text-neutral-600">
                            {stop.city} ({stop.airport_code})
                            <span className="text-neutral-400"> &middot; {stop.duration}</span>
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <CircleDot className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-emerald-700">Vuelo Directo</p>
                        <p className="text-xs text-neutral-500">Sin escalas</p>
                      </div>
                    </div>
                  )}

                  {/* Aircraft */}
                  {offer.aircraft_type && (
                    <div className="flex items-center gap-3">
                      <Plane className="h-5 w-5 text-brand-500 flex-shrink-0" />
                      <div>
                        <p className="font-semibold">Aeronave</p>
                        <p className="text-neutral-600">{offer.aircraft_type}</p>
                      </div>
                    </div>
                  )}

                  {/* Cabin Class */}
                  <div className="flex items-center gap-3">
                    <Armchair className="h-5 w-5 text-brand-500 flex-shrink-0" />
                    <div>
                      <p className="font-semibold">Clase</p>
                      <p className="text-neutral-600">{cabinLabel(offer.cabin_class)}</p>
                    </div>
                  </div>

                  {/* Baggage */}
                  {offer.baggage_included && (
                    <div className="flex items-center gap-3">
                      <Luggage className="h-5 w-5 text-brand-500 flex-shrink-0" />
                      <div>
                        <p className="font-semibold">Equipaje incluido</p>
                        <p className="text-neutral-600">{offer.baggage_included}</p>
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {/* Availability Card */}
              <Card variant="bordered">
                <h3 className="font-bold mb-3 flex items-center gap-2">
                  <Users className="h-5 w-5 text-brand-600" />
                  Disponibilidad
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-3">
                    <Timer className="h-5 w-5 text-brand-500 flex-shrink-0" />
                    <div>
                      <p className="font-semibold">Fechas disponibles</p>
                      <p className="text-neutral-500">{offer.valid_dates.length} fechas</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-brand-500 flex-shrink-0" />
                    <div>
                      <p className="font-semibold">Cupos restantes</p>
                      <p className={`font-bold ${seatsLeft <= 5 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {seatsLeft} disponibles
                      </p>
                    </div>
                  </div>
                  {seatsLeft <= 5 && (
                    <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                      <p className="text-xs font-semibold text-red-700">
                        Quedan muy pocos cupos. Reserva ahora para asegurar tu lugar.
                      </p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Tip */}
              <Card variant="bordered" className="bg-amber-50 border-amber-200">
                <p className="text-sm text-amber-800">
                  <strong>Tip:</strong> Selecciona una fecha iluminada en el calendario
                  para reservar al precio de oferta. Las fechas en gris no tienen disponibilidad.
                </p>
              </Card>

              {/* CTA button */}
              {defaultDate && (
                <Button className="w-full gap-2" size="lg" onClick={handleHeroClick}>
                  <Flame className="h-4 w-4" />
                  Reservar ahora — ${offer.offer_price}
                </Button>
              )}

              {!user && (
                <Card variant="bordered" className="bg-brand-50 border-brand-200">
                  <p className="text-sm text-brand-800">
                    <strong>Nota:</strong> Debes{' '}
                    <Link href={`/login?redirect=/offers/${params.id}`} className="font-bold underline">
                      iniciar sesión
                    </Link>{' '}
                    para reservar esta oferta.
                  </p>
                </Card>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
