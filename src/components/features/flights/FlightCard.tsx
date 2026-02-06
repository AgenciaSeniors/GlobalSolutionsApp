/**
 * @fileoverview Single flight result card with route timeline, airline info and CTA.
 * @module components/features/flights/FlightCard
 */
import { Plane, Flame } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { formatCurrency } from '@/lib/utils/formatters';

export interface FlightCardProps {
  airline: string;
  flightCode: string;
  originCode: string;
  destinationCode: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  stops: number;
  stopCities?: string;
  price: number;
  availableSeats: number;
  onSelect?: () => void;
}

export default function FlightCard({
  airline,
  flightCode,
  originCode,
  destinationCode,
  departureTime,
  arrivalTime,
  duration,
  stops,
  stopCities,
  price,
  availableSeats,
  onSelect,
}: FlightCardProps) {
  return (
    <article className="group grid grid-cols-1 items-center gap-6 rounded-2xl border-2 border-transparent bg-white p-6 shadow-sm transition-all duration-300 hover:border-brand-200 hover:shadow-lg hover:shadow-brand-600/[0.06] sm:grid-cols-[1fr_2fr_1fr]">
      {/* ── Airline ── */}
      <div>
        <span className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-600">
          <Plane className="h-5 w-5" />
        </span>
        <p className="text-[15px] font-bold text-neutral-900">{airline}</p>
        <p className="text-sm text-neutral-500">
          {flightCode} · Economy
        </p>
      </div>

      {/* ── Route Timeline ── */}
      <div className="flex items-center gap-4">
        <div className="text-center">
          <p className="text-2xl font-extrabold text-neutral-900">
            {departureTime}
          </p>
          <p className="text-sm font-semibold text-neutral-500">{originCode}</p>
        </div>

        <div className="flex-1 text-center">
          <p className="mb-1.5 text-xs text-neutral-400">{duration}</p>
          <div className="relative h-0.5 rounded bg-neutral-200">
            <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500" />
          </div>
          <p className="mt-1.5 text-xs font-medium text-brand-500">
            {stops === 0
              ? 'Directo'
              : `${stops} escala${stops > 1 ? 's' : ''}${stopCities ? ` · ${stopCities}` : ''}`}
          </p>
        </div>

        <div className="text-center">
          <p className="text-2xl font-extrabold text-neutral-900">
            {arrivalTime}
          </p>
          <p className="text-sm font-semibold text-neutral-500">
            {destinationCode}
          </p>
        </div>
      </div>

      {/* ── Price + CTA ── */}
      <div className="text-right">
        {availableSeats < 6 && (
          <Badge variant="destructive" className="mb-1.5 animate-pulse">
            <Flame className="h-3 w-3" />
            ¡{availableSeats} cupos!
          </Badge>
        )}
        <p className="text-3xl font-extrabold text-brand-700">
          {formatCurrency(price)}
        </p>
        <p className="mb-3 text-xs text-neutral-500">por persona</p>
        <Button size="sm" onClick={onSelect}>
          Seleccionar
        </Button>
      </div>
    </article>
  );
}
