import type { FlightOffer } from '@/types/models';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { Plane } from 'lucide-react';

interface FlightCardProps {
  flight: FlightOffer;
  onSelect?: (id: string) => void;
}

function formatTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function FlightCard({ flight, onSelect }: FlightCardProps) {
  const segments = flight.segments ?? [];
  const firstSegment = segments[0];
  const lastSegment = segments[segments.length - 1];

  // Si por alguna razón llega vacío, no reventamos la UI
  if (!firstSegment || !lastSegment) return null;

  const airlineName = firstSegment.airline?.name ?? 'Aerolínea';
  const airlineCode = firstSegment.airline?.code ?? '';
  const flightNumber = firstSegment.flightNumber ?? '';
  const originCode = firstSegment.origin ?? '';
  const destinationCode = lastSegment.destination ?? '';

  const departureTime = formatTime(firstSegment.departureTime);
  const arrivalTime = formatTime(lastSegment.arrivalTime);

  const isDirect = segments.length <= 1;
  const stopsCount = Math.max(0, segments.length - 1);

  const stopsLabel = isDirect ? 'Directo' : `${stopsCount} Escala${stopsCount === 1 ? '' : 's'}`;

  return (
    <article className="group grid grid-cols-1 items-center gap-6 rounded-2xl border-2 border-transparent bg-white p-6 shadow-sm transition-all duration-300 ease-out hover:-translate-y-1 hover:border-brand-200 hover:shadow-lg hover:shadow-brand-600/[0.06] sm:grid-cols-[1fr_2fr_1fr]">
      {/* 1) Aerolínea */}
      <div>
        <span className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-600">
          <Plane className="h-5 w-5" />
        </span>

        <p className="text-[15px] font-bold text-neutral-900">{airlineName}</p>

        <p className="text-sm text-neutral-500">
          {airlineCode}
          {airlineCode && flightNumber ? ' · ' : ''}
          {flightNumber ? `Vuelo ${flightNumber}` : ''}
        </p>
      </div>

      {/* 2) Horarios + ruta */}
      <div className="grid grid-cols-3 items-center gap-4">
        {/* Salida */}
        <div className="text-left">
          <p className="text-2xl font-bold text-neutral-900">{departureTime}</p>
          <p className="text-sm text-neutral-500">{originCode}</p>
        </div>

        {/* Duración + escalas */}
        <div className="flex flex-col items-center">
          <p className="text-xs text-neutral-400">{flight.totalDuration}</p>

          <div className="relative mt-2 w-full">
            <div className="h-[2px] w-full bg-neutral-200" />
            <Plane className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 bg-white px-1 text-neutral-300" />
          </div>

          <div className="mt-2">
            <Badge variant={isDirect ? 'success' : 'warning'}>{stopsLabel}</Badge>
          </div>
        </div>

        {/* Llegada */}
        <div className="text-right">
          <p className="text-2xl font-bold text-neutral-900">{arrivalTime}</p>
          <p className="text-sm text-neutral-500">{destinationCode}</p>
        </div>
      </div>

      {/* 3) Precio + CTA */}
      <div className="flex flex-row items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-center">
        <div className="text-right">
          <span className="text-xs text-neutral-400">Total por pasajero</span>
          <p className="text-3xl font-extrabold text-[#FF4757]">${flight.price}</p>
        </div>

        <Button
          onClick={() => onSelect?.(flight.id)}
          variant="primary"
          className="w-full sm:w-auto"
        >
          Seleccionar
        </Button>
      </div>
    </article>
  );
}
