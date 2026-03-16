/**
 * @fileoverview Public car detail page — full specs, image, description.
 * @module app/(public)/cars/[id]/page
 * @author Dev B
 */
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import JsonLd from '@/components/seo/JsonLd';
import Breadcrumbs from '@/components/seo/Breadcrumbs';
import Badge from '@/components/ui/Badge';
import { getCarById } from '@/lib/cars/service';
import { CATEGORY_LABELS, FUEL_LABELS } from '@/lib/cars/types';
import { formatCurrency } from '@/lib/utils/formatters';
import { buildAutoRentalSchema, buildProductReviewProps } from '@/lib/seo/jsonld';
import { getReviewStats } from '@/lib/seo/review-stats';
import ReserveWhatsApp from '@/components/features/cars/ReserveWhatsApp';
import {
  Car, Users, Fuel, Cog, Thermometer, Briefcase,
  MapPin, Calendar, ArrowLeft, DoorOpen, Palette,
} from 'lucide-react';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const car = await getCarById(id);
  if (!car) return { title: 'Auto no encontrado' };
  const title = `${car.brand} ${car.model} — Renta de Autos en Cuba`;
  const description = `Renta ${car.brand} ${car.model} en Cuba desde $${car.daily_rate}/día. ${car.passenger_capacity} pasajeros, ${car.transmission === 'automatic' ? 'automático' : 'manual'}. Reserva con Transtur vía Global Solutions Travel.`;
  return {
    title,
    description,
    alternates: { canonical: `/cars/${id}` },
    openGraph: {
      title,
      description,
      url: `/cars/${id}`,
      ...(car.image_url ? { images: [{ url: car.image_url, width: 1200, height: 630 }] } : {}),
    },
  };
}

export default async function CarDetailPage({ params }: Props) {
  const { id } = await params;
  const car = await getCarById(id);

  if (!car || !car.is_active) {
    notFound();
  }

  const specs = car.specs;

  const carUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/cars/${id}`
    : undefined;

  // JSON-LD structured data
  const reviewStats = await getReviewStats();
  const carSchema = {
    ...buildAutoRentalSchema({
      name: `${car.brand} ${car.model} — Renta en Cuba`,
      description: `Renta ${car.brand} ${car.model} en Cuba desde $${car.daily_rate}/día. ${car.passenger_capacity} pasajeros.`,
      lowPrice: car.daily_rate,
      provider: car.supplier || 'Transtur',
      areaServed: 'Cuba',
      image: car.image_url || undefined,
    }),
    ...buildProductReviewProps(reviewStats),
  };

  const breadcrumbItems = [
    { name: 'Inicio', href: '/' },
    { name: 'Autos', href: '/cars' },
    { name: `${car.brand} ${car.model}`, href: `/cars/${id}` },
  ];

  return (
    <>
      <JsonLd data={carSchema} />
      <Navbar />
      <main className="pt-[72px]">
        <section className="bg-white py-12">
          <div className="mx-auto max-w-6xl px-6">
            {/* Breadcrumb */}
            <Breadcrumbs items={breadcrumbItems} className="mb-6" />

            <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
              {/* Image */}
              <div>
                {car.image_url ? (
                  <Image
                    src={car.image_url}
                    alt={`${car.brand} ${car.model}`}
                    width={1200}
                    height={800}
                    unoptimized
                    className="h-80 w-full rounded-2xl object-cover border border-neutral-200 shadow-sm"
                  />
                ) : (
                  <div className="flex h-80 w-full items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 border border-brand-100">
                    <Car className="h-24 w-24 text-brand-300" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <Badge variant="info" className="mb-2">
                      {CATEGORY_LABELS[car.category as keyof typeof CATEGORY_LABELS] ?? car.category}
                    </Badge>
                    <h1 className="text-3xl font-bold text-neutral-900">
                      {car.brand} {car.model}
                    </h1>
                    {specs?.year && (
                      <p className="mt-1 text-neutral-500">{specs.year}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-extrabold text-brand-600">
                      {formatCurrency(car.daily_rate)}
                    </p>
                    <p className="text-sm text-neutral-500">por día</p>
                  </div>
                </div>

                {car.description && (
                  <p className="mt-5 text-neutral-600 leading-relaxed">{car.description}</p>
                )}

                {/* Location */}
                <div className="mt-5 flex items-center gap-2 text-sm text-neutral-600">
                  <MapPin className="h-4 w-4 text-brand-500" />
                  <span>Recogida: <strong>{car.pickup_location}</strong></span>
                  {car.dropoff_location && (
                    <span className="ml-2">· Devolución: <strong>{car.dropoff_location}</strong></span>
                  )}
                </div>

                {car.supplier && (
                  <p className="mt-2 text-sm text-neutral-500">
                    Proveedor: {car.supplier}
                  </p>
                )}

                {/* Feature chips */}
                {(car.features?.length ?? 0) > 0 && (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {car.features.map((f) => (
                      <span
                        key={f}
                        className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 border border-brand-100"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                )}

                {/* CTA (WhatsApp reservation) */}
                <ReserveWhatsApp
                  car={{
                    brand: car.brand,
                    model: car.model,
                    daily_rate: car.daily_rate,
                    currency: car.currency,
                    pickup_location: car.pickup_location,
                    dropoff_location: car.dropoff_location,
                  }}
                  carUrl={carUrl}
                />
              </div>
            </div>

            {/* ─── Specs Grid ─── */}
            <div className="mt-12">
              <h2 className="mb-6 text-xl font-bold text-neutral-900">Especificaciones</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                <SpecItem icon={Users} label="Pasajeros" value={`${specs?.seats ?? car.passenger_capacity}`} />
                <SpecItem icon={DoorOpen} label="Puertas" value={`${specs?.doors ?? 4}`} />
                <SpecItem icon={Cog} label="Transmisión" value={car.transmission === 'automatic' ? 'Automático' : 'Manual'} />
                <SpecItem icon={Thermometer} label="A/C" value={specs?.ac ? 'Sí' : 'No'} />
                <SpecItem icon={Fuel} label="Combustible" value={FUEL_LABELS[specs?.fuel ?? ''] ?? specs?.fuel ?? 'N/A'} />
                <SpecItem icon={Briefcase} label="Maletas" value={`${specs?.bags ?? car.luggage_capacity}`} />
                {specs?.engine && <SpecItem icon={Cog} label="Motor" value={specs.engine} />}
                {specs?.color && <SpecItem icon={Palette} label="Color" value={specs.color} />}
                {specs?.year && <SpecItem icon={Calendar} label="Año" value={`${specs.year}`} />}
              </div>
            </div>

            {/* ─── Policies ─── */}
            <div className="mt-12 rounded-2xl border border-neutral-200 bg-neutral-50 p-6">
              <h3 className="mb-3 font-bold text-neutral-900">Políticas de Renta</h3>
              <ul className="space-y-2 text-sm text-neutral-600">
                <li>• Seguro básico incluido en todas las rentas</li>
                <li>• Conductor debe ser mayor de 21 años con licencia vigente</li>
                <li>• Depósito reembolsable de $200 USD al retirar el vehículo</li>
                <li>• Asistencia en carretera 24/7 incluida</li>
                <li>• Cancelación gratuita hasta 48h antes de la recogida</li>
              </ul>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

/* ─── Spec display item ─── */
function SpecItem({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50">
        <Icon className="h-5 w-5 text-brand-500" />
      </div>
      <div>
        <p className="text-xs text-neutral-500">{label}</p>
        <p className="font-semibold text-neutral-900">{value}</p>
      </div>
    </div>
  );
}
