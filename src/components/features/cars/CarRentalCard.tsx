/**
 * @fileoverview Display card for a single rental vehicle.
 * @module components/features/cars/CarRentalCard
 */
import { Car, Users } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { formatCurrency } from '@/lib/utils/formatters';
import type { CarRental } from '@/types/models';

interface CarRentalCardProps {
  car: CarRental;
}

export default function CarRentalCard({ car }: CarRentalCardProps) {
  return (
    <article className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-all duration-300 hover:shadow-lg">
      {/* Placeholder image */}
      <div className="relative flex h-44 items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100">
        <Car className="h-16 w-16 text-brand-300" />
        <Badge className="absolute left-4 top-4">{car.category}</Badge>
      </div>

      <div className="p-6">
        <h3 className="text-xl font-bold text-neutral-900">
          {car.brand} {car.model}
        </h3>

        {/* Specs */}
        <div className="mt-3 flex gap-4 text-sm text-neutral-600">
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" /> {car.passenger_capacity}
          </span>
          <span>{car.transmission === 'automatic' ? 'Automático' : 'Manual'}</span>
          <span>{car.luggage_capacity} maleta{car.luggage_capacity !== 1 && 's'}</span>
        </div>

        {/* Feature chips */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {car.features.map((f) => (
            <span
              key={f}
              className="rounded-md bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600"
            >
              {f}
            </span>
          ))}
        </div>

        {/* Price + CTA */}
        <div className="mt-5 flex items-center justify-between border-t border-neutral-100 pt-5">
          <div>
            <span className="text-2xl font-extrabold text-brand-600">
              {formatCurrency(car.daily_rate)}
            </span>
            <span className="text-sm text-neutral-500"> /día</span>
          </div>
          <Button variant="outline" size="sm">
            Reservar
          </Button>
        </div>
      </div>
    </article>
  );
}
