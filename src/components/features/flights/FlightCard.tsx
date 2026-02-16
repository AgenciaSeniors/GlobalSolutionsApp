import type { FlightOffer } from '@/types/models';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { Plane, ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import FlightStopsDetails from './FlightStopsDetails';

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

  const logoUrl = firstSegment.airline?.logoUrl ?? '';

  // ✅ fallback real
  const [canShowLogo, setCanShowLogo] = useState(Boolean(logoUrl));
  useEffect(() => setCanShowLogo(Boolean(logoUrl)), [logoUrl]);

  // ✅ NUEVO: Estado para mostrar/ocultar detalles de escalas
  const [showStopsDetails, setShowStopsDetails] = useState(false);

  // ✅ NUEVO: Obtener aeropuertos de escalas para mostrar en el badge
  const stopAirports = !isDirect
    ? segments
        .slice(0, -1)
        .map((seg) => seg.destination)
        .join(', ')
    : '';

  return (
    <article className="group rounded-2xl border-2 border-transparent bg-white p-6 shadow-sm transition-all duration-300 ease-out hover:-translate-y-1 hover:border-brand-200 hover:shadow-lg hover:shadow-brand-600/[0.06]">
      <div className="grid grid-cols-1 items-center gap-6 sm:grid-cols-[1fr_2fr_1fr]">
        <div>
          <span className="mb-2 flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-600">
            {canShowLogo ? (
              <img
                src={logoUrl}
                alt={airlineName}
                className="h-10 w-10 object-contain"
                onError={() => setCanShowLogo(false)}
              />
            ) : (
              <Plane className="h-5 w-5" />
            )}
          </span>

          <p className="text-[15px] font-bold text-neutral-900">{airlineName}</p>

          <p className="text-sm text-neutral-500">
            {airlineCode}
            {airlineCode && flightNumber ? ' · ' : ''}
            {flightNumber ? `Vuelo ${flightNumber}` : ''}
          </p>
        </div>

        <div className="grid grid-cols-3 items-center gap-4">
          <div className="text-left">
            <p className="text-2xl font-bold text-neutral-900">{departureTime}</p>
            <p className="text-sm text-neutral-500">{originCode}</p>
          </div>

          <div className="flex flex-col items-center">
            <p className="text-xs text-neutral-400">{flight.totalDuration}</p>

            <div className="relative mt-2 w-full">
              <div className="h-[2px] w-full bg-neutral-200" />
              <Plane className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 bg-white px-1 text-neutral-300" />
            </div>

            <div className="mt-2">
              {/* ✅ MEJORADO: Badge clickeable con info de escalas */}
              {!isDirect ? (
                <button
                  onClick={() => setShowStopsDetails(!showStopsDetails)}
                  className="group/badge flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 transition-all hover:bg-amber-200 hover:shadow-md"
                  title={`Vía ${stopAirports}`}
                >
                  <span className="text-xs font-semibold text-amber-700">{stopsLabel}</span>
                  <span className="text-[10px] text-amber-600">vía {stopAirports}</span>
                  {showStopsDetails ? (
                    <ChevronUp className="h-3.5 w-3.5 text-amber-600 transition-transform group-hover/badge:scale-110" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-amber-600 transition-transform group-hover/badge:scale-110" />
                  )}
                </button>
              ) : (
                <Badge variant="success">{stopsLabel}</Badge>
              )}
            </div>
          </div>

          <div className="text-right">
            <p className="text-2xl font-bold text-neutral-900">{arrivalTime}</p>
            <p className="text-sm text-neutral-500">{destinationCode}</p>
          </div>
        </div>

        <div className="flex flex-row items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-center">
          <div className="text-right">
            <span className="text-xs text-neutral-400">Total por pasajero</span>
            <p className="text-3xl font-extrabold text-[#FF4757]">${flight.price}</p>
          </div>

          <Button onClick={() => onSelect?.(flight.id)} variant="primary" className="w-full sm:w-auto">
            Seleccionar
          </Button>
        </div>
      </div>

      {/* ✅ NUEVO: Componente de detalles de escalas */}
      <FlightStopsDetails segments={segments} isOpen={showStopsDetails} />
    </article>
  );
}