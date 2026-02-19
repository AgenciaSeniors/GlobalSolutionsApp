/**
 * @fileoverview Public car rentals listing with search filters.
 * Server component that queries Supabase directly.
 * @module app/(public)/cars/page
 * @author Dev B
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import CarRentalCard from '@/components/features/cars/CarRentalCard';
import { searchCars } from '@/lib/cars/service';
import { CAR_CATEGORIES, CATEGORY_LABELS } from '@/lib/cars/types';
import type { CarSearchParams, CarCategory } from '@/lib/cars/types';
import { Car, SlidersHorizontal } from 'lucide-react';

export const metadata: Metadata = { title: 'Renta de Autos — Global Solutions Travel' };

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CarsPage({ searchParams }: Props) {
  const sp = await searchParams;

  const filters: CarSearchParams = {};
  if (sp.category && CAR_CATEGORIES.includes(sp.category as CarCategory)) {
    filters.category = sp.category as CarCategory;
  }
  if (sp.transmission === 'manual' || sp.transmission === 'automatic') {
    filters.transmission = sp.transmission;
  }
  if (sp.minPrice) filters.minPrice = Number(sp.minPrice);
  if (sp.maxPrice) filters.maxPrice = Number(sp.maxPrice);
  if (sp.minSeats) filters.minSeats = Number(sp.minSeats);
  if (sp.ac === 'true') filters.ac = true;

  const cars = await searchCars(filters);

  const hasFilters = Object.keys(filters).length > 0;

  return (
    <>
      <Navbar />
      <main className="pt-[72px]">
        <section className="bg-white py-16">
          <div className="mx-auto max-w-7xl px-6">
            {/* Header */}
            <div className="mb-10 text-center">
              <span className="text-sm font-bold uppercase tracking-widest text-brand-500">
                Renta de Autos
              </span>
              <h1 className="mt-2 font-display text-4xl font-bold text-brand-950">
                Explora Cuba a tu ritmo
              </h1>
              <p className="mx-auto mt-2 max-w-lg text-neutral-600">
                Vehículos confiables con seguro incluido y asistencia en carretera 24/7
              </p>
            </div>

            {/* Filters bar */}
            <div className="mb-8 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <form className="flex flex-wrap items-end gap-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
                  <SlidersHorizontal className="h-4 w-4" />
                  Filtros
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-500">Categoría</label>
                  <select
                    name="category"
                    defaultValue={filters.category ?? ''}
                    className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Todas</option>
                    {CAR_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-500">Transmisión</label>
                  <select
                    name="transmission"
                    defaultValue={filters.transmission ?? ''}
                    className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Todas</option>
                    <option value="automatic">Automático</option>
                    <option value="manual">Manual</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-500">Precio máx/día</label>
                  <input
                    name="maxPrice"
                    type="number"
                    min={0}
                    defaultValue={filters.maxPrice ?? ''}
                    placeholder="$"
                    className="w-24 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-500">Min. asientos</label>
                  <select
                    name="minSeats"
                    defaultValue={filters.minSeats ?? ''}
                    className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Todos</option>
                    <option value="4">4+</option>
                    <option value="5">5+</option>
                    <option value="7">7+</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
                >
                  Filtrar
                </button>

                {hasFilters && (
                  <Link
                    href="/cars"
                    className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
                  >
                    Limpiar
                  </Link>
                )}
              </form>
            </div>

            {/* Results */}
            {cars.length === 0 ? (
              <div className="py-20 text-center">
                <Car className="mx-auto h-16 w-16 text-neutral-300" />
                <p className="mt-4 text-lg font-medium text-neutral-500">
                  No se encontraron autos{hasFilters ? ' con esos filtros' : ''}
                </p>
                {hasFilters && (
                  <Link
                    href="/cars"
                    className="mt-3 inline-block text-sm font-semibold text-brand-600 hover:underline"
                  >
                    Ver todos los autos
                  </Link>
                )}
              </div>
            ) : (
              <>
                <p className="mb-4 text-sm text-neutral-500">
                  {cars.length} auto{cars.length !== 1 && 's'} disponible{cars.length !== 1 && 's'}
                </p>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {cars.map((car) => (
                    <CarRentalCard key={car.id} car={car} />
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
