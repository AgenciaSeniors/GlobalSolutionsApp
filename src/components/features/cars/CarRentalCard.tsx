/**
 * @fileoverview Display card for a single rental vehicle.
 * Now links to /cars/[id] detail page and shows specs.
 * @module components/features/cars/CarRentalCard
 * @author Dev B
 */
import Link from 'next/link';
import { Car, Users, Fuel, Cog } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { formatCurrency } from '@/lib/utils/formatters';
import type { Car as CarType } from '@/lib/cars/types';
import { CATEGORY_LABELS } from '@/lib/cars/types';

interface CarRentalCardProps {
  car: CarType;
}

export default function CarRentalCard({ car }: CarRentalCardProps) {
  const specs = car.specs;

  return (
    <Link href={`/cars/${car.id}`} className="block">
      <article className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-[2px]">
        {/* Image */}
        <div className="relative flex h-44 items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100">
          {car.image_url ? (
            <img
              src={car.image_url}
              alt={`${car.brand} ${car.model}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <Car className="h-16 w-16 text-brand-300" />
          )}
          <Badge variant="offer" className="absolute left-4 top-4">
            {CATEGORY_LABELS[car.category as keyof typeof CATEGORY_LABELS] ?? car.category}
          </Badge>
        </div>

        <div className="p-6">
          <h3 className="text-xl font-bold text-neutral-900">
            {car.brand} {car.model}
          </h3>
          {specs?.year && (
            <p className="text-sm text-neutral-400">{specs.year}</p>
          )}

          {/* Specs row */}
          <div className="mt-3 flex gap-4 text-sm text-neutral-600">
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> {specs?.seats ?? car.passenger_capacity}
            </span>
            <span className="flex items-center gap-1">
              <Cog className="h-3.5 w-3.5" /> {car.transmission === 'automatic' ? 'Auto' : 'Manual'}
            </span>
            <span className="flex items-center gap-1">
              <Fuel className="h-3.5 w-3.5" /> {car.luggage_capacity} maleta{car.luggage_capacity !== 1 && 's'}
            </span>
          </div>

          {/* Feature chips */}
          {car.features.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {car.features.slice(0, 4).map((f) => (
                <span
                  key={f}
                  className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 border border-brand-100"
                >
                  {f}
                </span>
              ))}
              {car.features.length > 4 && (
                <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-500">
                  +{car.features.length - 4}
                </span>
              )}
            </div>
          )}

          {/* Price + CTA */}
          <div className="mt-5 flex items-center justify-between border-t border-neutral-100 pt-5">
            <div>
              <span className="text-2xl font-extrabold text-brand-600">
                {formatCurrency(car.daily_rate)}
              </span>
              <span className="text-sm text-neutral-500"> /día</span>
            </div>
            <Button variant="outline" size="sm">
              Ver Detalle
            </Button>
          </div>
        </div>
      </article>
    </Link>
  );
}
