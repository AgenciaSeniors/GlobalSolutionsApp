/**
 * @fileoverview Renders a sorted list of FlightCard results.
 * @module components/features/flights/FlightResultsList
 */
'use client';

import FlightCard, { type FlightCardProps } from './FlightCard';
import Skeleton from '@/components/ui/Skeleton';

interface FlightResultsListProps {
  flights: FlightCardProps[];
  isLoading?: boolean;
}

export default function FlightResultsList({
  flights,
  isLoading = false,
}: FlightResultsListProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-36 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (flights.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-neutral-200 py-16 text-center">
        <p className="text-lg font-semibold text-neutral-600">
          No se encontraron vuelos
        </p>
        <p className="mt-1 text-sm text-neutral-400">
          Intenta con otras fechas o destinos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-neutral-900">
          {flights.length} vuelo{flights.length !== 1 && 's'} encontrado
          {flights.length !== 1 && 's'}
        </h3>
        <span className="text-sm text-neutral-500">
          Ordenado por: Precio más bajo
        </span>
      </div>

      {flights.map((flight, idx) => (
        <div
          key={idx}
          className="animate-fade-in-up opacity-0"
          style={{ animationDelay: `${idx * 100}ms`, animationFillMode: 'forwards' }}
        >
          <FlightCard {...flight} />
        </div>
      ))}
    </div>
  );
}
