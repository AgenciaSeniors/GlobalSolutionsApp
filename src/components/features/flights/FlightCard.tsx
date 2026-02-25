import type { FlightOffer } from '@/types/models';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { Plane, ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import FlightStopsDetails from './FlightStopsDetails';

interface FlightCardProps {
  flight: FlightOffer;
  onSelect?: (id: string) => void;
}

function formatTime(value: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  // Always display in Cuba time (America/Havana) regardless of the user's browser TZ.
  // The provider already emits ISO strings with the Cuba offset (-05:00 / -04:00 DST),
  // so new Date() parses them to the correct UTC instant; we only need to display in Cuba TZ.
  return d.toLocaleTimeString('es-CU', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Havana' });
}

export default function FlightCard({ flight, onSelect }: FlightCardProps) {
  const segments = flight.segments ?? [];
  const firstSegment = segments[0];
  const lastSegment = segments[segments.length - 1];

  const airlineName = firstSegment?.airline?.name ?? 'Aerolínea';
  const airlineCode = firstSegment?.airline?.code ?? '';
  const flightNumber = firstSegment?.flightNumber ?? '';
  const originCode = firstSegment?.origin ?? '';
  const destinationCode = lastSegment?.destination ?? '';

  const departureTime = formatTime(firstSegment?.departureTime ?? '');
  const arrivalTime = formatTime(lastSegment?.arrivalTime ?? '');

  const isDirect = segments.length <= 1;
  const stopsCount = Math.max(0, segments.length - 1);
  const stopsLabel = isDirect ? 'Directo' : `${stopsCount} Escala${stopsCount === 1 ? '' : 's'}`;

  const logoUrl = firstSegment?.airline?.logoUrl ?? '';

  // ── All hooks BEFORE any conditional return (Rules of Hooks) ──
  const [canShowLogo, setCanShowLogo] = useState(Boolean(logoUrl));
  useEffect(() => setCanShowLogo(Boolean(logoUrl)), [logoUrl]);

  const [showStopsDetails, setShowStopsDetails] = useState(false);

  const stopAirports = useMemo(() => {
    if (isDirect) return '';
    return segments
      .slice(0, -1)
      .map((seg) => seg.destination)
      .filter(Boolean)
      .join(', ');
  }, [segments, isDirect]);

  const stopAirportsShort = useMemo(() => {
    if (!stopAirports) return '';
    const list = stopAirports.split(', ').filter(Boolean);
    const short = list.slice(0, 2).join(', ');
    return list.length > 2 ? `${short}…` : short;
  }, [stopAirports]);

  // ── Guard AFTER all hooks ──
  if (!firstSegment || !lastSegment) return null;

  return (
    <article className="group rounded-2xl border-2 border-transparent bg-white p-4 shadow-sm transition-all duration-300 ease-out hover:-translate-y-1 hover:border-brand-200 hover:shadow-lg hover:shadow-brand-600/[0.06] sm:p-6">
      <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[1fr_2fr_1fr] sm:gap-6">
        {/* Airline */}
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

        {/* Times */}
        <div className="grid grid-cols-3 items-center gap-2 sm:gap-4">
          <div className="text-left">
            <p className="text-xl font-bold text-neutral-900 sm:text-2xl">{departureTime}</p>
            <p className="text-xs text-neutral-500 sm:text-sm">{originCode}</p>
          </div>

          <div className="flex flex-col items-center">
            <p className="text-xs text-neutral-400">{flight.totalDuration}</p>

            <div className="relative mt-2 w-full">
              <div className="h-[2px] w-full bg-neutral-200" />
              <Plane className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 bg-white px-1 text-neutral-300" />
            </div>

            <div className="mt-2">
              {!isDirect ? (
                <button
                  onClick={() => setShowStopsDetails(!showStopsDetails)}
                  className="group/badge flex max-w-full items-center gap-1 rounded-full bg-amber-100 px-2 py-1 transition-all hover:bg-amber-200 hover:shadow-md sm:max-w-[240px] sm:gap-2 sm:px-3"
                  title={`Vía ${stopAirports}`}
                  type="button"
                >
                  <span className="text-xs font-semibold text-amber-700">{stopsLabel}</span>
                  <span className="hidden max-w-[140px] truncate text-[10px] text-amber-700/80 sm:inline">
                    vía {stopAirportsShort}
                  </span>
                  {showStopsDetails ? (
                    <ChevronUp className="h-3 w-3 text-amber-700 transition-transform group-hover/badge:scale-110 sm:h-3.5 sm:w-3.5" />
                  ) : (
                    <ChevronDown className="h-3 w-3 text-amber-700 transition-transform group-hover/badge:scale-110 sm:h-3.5 sm:w-3.5" />
                  )}
                </button>
              ) : (
                <Badge variant="success">{stopsLabel}</Badge>
              )}
            </div>
          </div>

          <div className="text-right">
            <p className="text-xl font-bold text-neutral-900 sm:text-2xl">{arrivalTime}</p>
            <p className="text-xs text-neutral-500 sm:text-sm">{destinationCode}</p>
          </div>
        </div>

        {/* Price + CTA */}
        <div className="flex flex-row items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-center">
          <div className="sm:text-right">
            <span className="text-xs text-neutral-400">Total por pasajero</span>
            <p className="text-2xl font-extrabold text-[#FF4757] sm:text-3xl">${flight.price}</p>
          </div>

          <Button
            onClick={() => onSelect?.(flight.id)}
            variant="primary"
            className="shrink-0 sm:w-auto"
          >
            Seleccionar
          </Button>
        </div>
      </div>

      <FlightStopsDetails segments={segments} isOpen={showStopsDetails} />
    </article>
  );
}
