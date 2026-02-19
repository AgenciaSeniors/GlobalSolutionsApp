/**
 * @fileoverview Offer detail page with interactive visual calendar.
 * Per spec §3.2: "Click on offer → calendar shows ONLY offer days illuminated."
 * @module app/(public)/offers/[id]/page
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import OfferCalendar from '@/components/features/offers/OfferCalendar';
import { createClient } from '@/lib/supabase/client';
import { useAuthContext } from '@/components/providers/AuthProvider';
import { ArrowLeft, Flame, MapPin, Plane, Clock, Shield } from 'lucide-react';
import Link from 'next/link';
import type { SpecialOffer } from '@/types/models';

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
        .select('*')
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

  async function resolveOfferFlightId(dateStr: string): Promise<string | null> {
    // Search the flights table for a matching exclusive-offer flight on that day.
    // If multiple match, pick the earliest departure.
    const start = new Date(`${dateStr}T00:00:00.000Z`).toISOString();
    const end = new Date(`${dateStr}T23:59:59.999Z`).toISOString();

    let query = supabase
      .from('flights')
      .select('*')
      .eq('is_exclusive_offer', true)
      .gte('departure_datetime', start)
      .lte('departure_datetime', end);

    if (offer?.airline_id) query = query.eq('airline_id', offer.airline_id);
    if (offer?.flight_number) query = query.eq('flight_number', offer.flight_number);
    if (offer?.origin_airport_id) query = query.eq('origin_airport_id', offer.origin_airport_id);
    if (offer?.destination_airport_id) query = query.eq('destination_airport_id', offer.destination_airport_id);

    const { data, error } = await query.order('departure_datetime', { ascending: true }).limit(1);
    if (error) {
      console.error('[OfferDetail] resolveOfferFlightId error:', error);
      return null;
    }
    const flight = (data ?? [])[0] as Record<string, unknown> | undefined;
    if (!flight?.id) return null;

    // Preload for checkout (it will read this if it matches the URL flight id)
    try {
      sessionStorage.setItem('selectedFlightData', JSON.stringify(flight));
    } catch (e) {
      console.warn('[OfferDetail] sessionStorage set error:', e);
    }
    return String(flight.id);
  }

  function handleSelectDate(date: string) {
    if (!user) {
      router.push(`/login?redirect=/offers/${params.id}`);
      return;
    }
    // Navigate directly to checkout with flight id
    (async () => {
      const flightId = await resolveOfferFlightId(date);
      if (!flightId) {
        alert('No se encontró un vuelo para esta oferta en esa fecha. Verifica que exista en la tabla flights (is_exclusive_offer=true) y coincida con la oferta.');
        return;
      }
      router.push(`/checkout?flight=${flightId}&passengers=1`);
    })();
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

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-neutral-50 pt-[72px]">
        {/* Hero */}
        <div
          className="relative bg-gradient-to-br from-brand-900 via-brand-800 to-indigo-900 py-16 cursor-pointer"
          onClick={handleHeroClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handleHeroClick();
          }}
        >
          <div className="mx-auto max-w-5xl px-6">
            <Link
              href="/offers"
              onClick={(e) => e.stopPropagation()}
              className="mb-4 inline-flex items-center gap-1 text-sm text-brand-200 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" /> Volver a ofertas
            </Link>
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  {offer.tags.includes('fire') && <Flame className="h-5 w-5 text-orange-400" />}
                  {offer.tags.map(tag => (
                    <Badge key={tag} variant="warning" className="text-xs">
                      {tag === 'exclusive' ? 'Exclusivo' : tag === 'flash_24h' ? 'Flash 24h' : tag === 'few_seats' ? 'Pocos cupos' : tag}
                    </Badge>
                  ))}
                </div>
                <h1 className="font-display text-4xl font-bold text-white">
                  <MapPin className="mr-2 inline h-8 w-8 text-brand-300" />
                  {offer.destination}
                </h1>
                {offer.urgency_label && (
                  <p className="mt-2 text-lg text-amber-300 font-semibold">{offer.urgency_label}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-lg text-brand-300 line-through">${offer.original_price}</p>
                <p className="text-5xl font-extrabold text-white">${offer.offer_price}</p>
                <p className="mt-1 text-sm text-emerald-300 font-semibold">Ahorras {savingsPct}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="mx-auto max-w-5xl px-6 py-12">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
            {/* Calendar (takes more space) */}
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
              <Card variant="bordered">
                <h3 className="font-bold mb-3">Detalles de la Oferta</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-3">
                    <Plane className="h-5 w-5 text-brand-500 flex-shrink-0" />
                    <div>
                      <p className="font-semibold">Vuelo</p>
                      <p className="text-neutral-500">{offer.flight_number || 'Múltiples opciones'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-brand-500 flex-shrink-0" />
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
                </div>
              </Card>

              <Card variant="bordered" className="bg-amber-50 border-amber-200">
                <p className="text-sm text-amber-800">
                  <strong>💡 Tip:</strong> Selecciona una fecha iluminada en el calendario
                  para reservar al precio de oferta. Las fechas en gris no tienen disponibilidad.
                </p>
              </Card>

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
